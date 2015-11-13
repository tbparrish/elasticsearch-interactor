var cpu = require('./aggregators/cpu'),
    memory = require('./aggregators/memory'),
    octets = require('./aggregators/octets'),
    packets = require('./aggregators/packets'),
    responseTime = require('./aggregators/responseTime');

var moment = require('moment');

function constructOptions(type, body) {
  return {
    index: 'overwatch-*',
    search_type: 'count',
    type: type,
    ignore_unavailable: true,
    body: _(body).defaults({ size: 0 }).toObject()
  };
}

function constructFilter(fromIso, toIso, hostnames, extraTerms) {
  var shouldFilters = [];

  var mustFilters = [{
    range: {
      "@timestamp": {
        gte: fromIso,
        lte: toIso,
        format: 'date_optional_time'
      }
    }
  }];

  if (extraTerms) {
    _(extraTerms).each(function (value, key) {
      var obj = {}; obj[key] = value; mustFilters.push({ term: obj });
    });
  }

  if(hostnames) {
    if(Array.isArray(hostnames)) {
      hostnames.map(function(hostname) {
          var obj = {}; obj.host = hostname; shouldFilters.push({ term: obj });
      });
    } else {
      shouldFilters.push({ term: { host: hostnames }});
    }
  }

  if(shouldFilters.length === 0) {
    return {
      filtered: { filter: { bool: { must: mustFilters }}}
    };
  } else {
    return {
      filtered: { filter: { bool: { must: mustFilters, should: shouldFilters }}}
    };
  }
}

function lineChart(aggs) {

  function aggregation (from, to, interval) {
    return {
       time: {
        date_histogram: {
          field: "@timestamp",
          interval: interval || "minute", // TODO rhodri, auto calculate,
          min_doc_count: 0,
          extended_bounds : {
            min: from,
            max: to
          }
        },
        aggregations: {
          yAxis: aggs
        }
      }
    };
  }

  function transform(results) {
    return [{
      values: results.aggregations.time.buckets.map(function (bucket) {
        return { x: bucket.key_as_string, y: bucket.yAxis.value };
      })
    }];
  }

  return { aggregation: aggregation, transform: transform };
}

function multiLineChart(splitField, valueField) {

  valueField = valueField || "value";

  function aggregation (from, to, interval) {
    return {
      lines: {
        terms: { field: splitField },
        aggregations: {
          time: {
            date_histogram: {
              field: "@timestamp",
              interval: interval || 'hour',
              min_doc_count: 0,
              extended_bounds : {
                min: from,
                max: to
              }
            },
            aggregations: {
              yAxis: { max: { field: valueField }}
            }
          }
        }
      }
    };
  }

  function transform(results) {
    return results.aggregations.lines.buckets.map(function (line) {
      return { key: line.key, values: line.time.buckets.map(function (bucket) {
        return { x: bucket.key_as_string, y: bucket.yAxis.value };
      })};
    });
  }

  return { aggregation: aggregation, transform: transform };
}

function sum(aggs, unit) {

  function aggregation () {
    return {
      time: aggs
    };
  }

  function transform(results) {
    return { value: results.aggregations.time.value, unit: unit };
  }

  return { aggregation: aggregation, transform: transform };
}

function pieChart(field) {

  function aggregation () {
    return {
      slices: { terms: { field: field } }
    };
  }

  function transform(results) {
    return results.aggregations.slices.buckets.map(function (bucket) {
      return { x: bucket.key, y: bucket.doc_count };
    });
  }

  return { aggregation: aggregation, transform: transform };
}

function table(x, y) {

  function aggregation () {
    return {
      x: {
        terms: { field: x },
        aggregations: {
          y: {
            terms: { field: y },
            aggregations: {
              sum: {
                sum: {
                  field: "value"
                }
              }
            }
          }
        }
      }
    };
  }

  function transform(results) {
    var keys = [ x ];
    var rows = [];
    results.aggregations.x.buckets.forEach(function (xBucket, i) {
      var row = {};
      row[x] = xBucket.key;
      xBucket.y.buckets.forEach(function (yBucket) {
        if (!i) { keys.push(yBucket.key); }
        row[yBucket.key] = yBucket.sum.value;
      });
      rows.push(row);
    });

    return { keys: keys, rows: rows };
  }

  return { aggregation: aggregation, transform: transform };
}

function aggregation(type, aggs, terms, filters) {

  return function(params) {

    var fromIso = moment(params.from).utc().toISOString(),
        toIso = moment(params.to).utc().toISOString();

    var options = constructOptions(type, {
      query: constructFilter(fromIso, toIso, params.hostnames, terms),
      aggregations: aggs.aggregation(fromIso, toIso, params.interval, filters)
    });

    return { options: options, transform: aggs.transform };
  }
}

module.exports = {

  responseTime: aggregation("syslog",
    responseTime.multiLineChart("host", {avg: { field: "response_time_ms"}})),

  signatures: aggregation("syslog", lineChart({
    max: {
      field: "request_count"
    }
  })),

  errorMessage: aggregation("syslog", pieChart("error_message")),
  errorReason: aggregation("syslog", pieChart("error_reason")),

  cpu: aggregation("collectd", cpu.multiLineChart("host"), { plugin: "cpu" },
    { "user"  : {term : {"type_instance" : "user"}},"nice"  : {term : {"type_instance" : "nice"}},
                  "system": {term : {"type_instance" : "system"}}, "idle"  : {term : {"type_instance" : "idle"}}}),
  memory: aggregation("collectd", memory.multiLineChart("host"), { plugin: "memory" },
    { "used"  : {term : {"type_instance" : "used"}},"free"  : {term : {"type_instance" : "free"}}}),
  swap: aggregation("collectd", multiLineChart("plugin_instance"), { plugin: "swap" }),

  interfacesOctets: aggregation("collectd", octets.multiLineChart("host"), { plugin: "interface", collectd_type: "if_octets" }),
  interfacesPackets: aggregation("collectd", packets.multiLineChart("host"), { plugin: "interface", collectd_type: "if_packets" }),
  interfacesErrors: aggregation("collectd", multiLineChart("plugin_instance", "rx"), { plugin: "interface", collectd_type: "if_errors" }),

  connections: aggregation("collectd", table("plugin_instance", "type_instance"), { plugin: "tcpconns" }),

  responseTimeAverage: aggregation("syslog", sum({
    avg: {
      field: "response_time_ms"
    }
  }, 'ms'))
};
