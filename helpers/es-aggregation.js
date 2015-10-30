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

  var filters = [{
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
      var obj = {}; obj[key] = value; filters.push({ term: obj })
    });
  }

  if(hostnames) {
    for(var i = 0; i < hostnames.length; i++) {
      var obj = {}; obj["host"] = hostnames[i]; filters.push({ term: obj })
    }
  }

  return {
    filtered: { filter: { bool: { must: filters }}}
  };
}

function lineChart(aggs) {

  function aggregation (from, to, interval) {
    return {
      "time": {
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
          "yAxis": aggs
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
      "lines": {
        terms: { field: splitField },
        aggregations: {
          "time": {
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
              "yAxis": { max: { field: valueField }}
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

function cpuMultiLineChart(splitField, valueField) {

  valueField = valueField || "value";

  function aggregation (from, to, interval, hostnames) {

    var hosts = {};

    if(hostnames) {
      if( hostnames.length > 0 ) {
        var filters = {};
        for(var i = 0; i < hostnames.length; i++) {
          filters[hostnames[i]] = {"term" : { "host": hostnames[i]}};
        }
        hosts["filters"] = {filters : filters};
      } else {
          hosts["terms"] = {field: splitField};
      }
    } else {
        hosts["terms"] = {field: splitField};
    }

    hosts["aggregations"] = {  
      "cpu_stats": { 
          filters : {
            filters : {
              "user"  : {term : {"type_instance" : "user"}},
              "nice"  : {term : {"type_instance" : "nice"}},
              "system": {term : {"type_instance" : "system"}},
              "idle"  : {term : {"type_instance" : "idle"}}
            }
          },
         aggregations: {  
            "time": {  
               date_histogram: {  
                field:"@timestamp",
                interval: interval || 'hour',
                min_doc_count:0,
                extended_bounds:{  
                   min: from,
                   max: to
                }
               },
               aggregations: {  
                  "stat": { avg: { field: valueField }}
               }
            }
         }
      }
    }
    
    return { hosts : hosts };
  }

  function transform(results) {
    var transformAllHosts = false;

    if(Array.isArray(results.aggregations.hosts.buckets)) {
        transformAllHosts = true;
    } 

    if(transformAllHosts) {
      return results.aggregations.hosts.buckets.map( function (host) {
        return {
          key : host.key, values : transformCpuStats(host.cpu_stats.buckets)
        };
      });
    } else {
        var stats = [];
        for(var p in results.aggregations.hosts.buckets) {
          if(results.aggregations.hosts.buckets.hasOwnProperty(p)) {
            stats.push( { key : p, 
                        values : 
                        transformCpuStats(results.aggregations.hosts.buckets[p].cpu_stats.buckets)});
        }
      }
      return stats;
    }
  }

  function transformCpuStats(buckets) {
    var stats = [];

    for (var i = 0; i < buckets.user.time.buckets.length; i++) {

        var key = buckets.user.time.buckets[i].key_as_string;
        var tempValue = buckets.user.time.buckets[i].stat.value +
                   buckets.nice.time.buckets[i].stat.value +
                   buckets.system.time.buckets[i].stat.value;

        stats.push(
          { 
            x : key,
            y : ((tempValue)/
                (tempValue+buckets.idle.time.buckets[i].stat.value))*100
          }
        );
      }
      return stats;
    }

  return { aggregation: aggregation, transform: transform };
}

function sum(aggs, unit) {

  function aggregation () {
    return {
      "time": aggs
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
      "slices": { terms: { field: field } }
    }
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
      "x": {
        terms: { field: x },
        aggregations: {
          "y": {
            terms: { field: y },
            aggregations: {
              "sum": {
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
        if (!i) keys.push(yBucket.key);
        row[yBucket.key] = yBucket.sum.value;
      });
      rows.push(row);
    });

    return { keys: keys, rows: rows };
  }

  return { aggregation: aggregation, transform: transform }
}

function aggregation(type, aggs, terms) {

  return function(params) {

    var fromIso = moment(params.from).utc().toISOString(),
        toIso = moment(params.to).utc().toISOString();

    var options = constructOptions(type, {
      query: constructFilter(fromIso, toIso, params.hostnames, terms),
      aggregations: aggs.aggregation(fromIso, toIso, params.interval, params.hostnames)
    });

    return { options: options, transform: aggs.transform };
  }
}

module.exports = {

  responseTime: aggregation("syslog", lineChart({
    avg: {
      field: "response_time_ms"
    }
  })),

  signatures: aggregation("syslog", lineChart({
    max: {
      field: "request_count"
    }
  })),

  errorMessage: aggregation("syslog", pieChart("error_message")),
  errorReason: aggregation("syslog", pieChart("error_reason")),

  //cpu: aggregation("collectd", multiLineChart("type_instance"), { plugin: "cpu" }),
  cpu: aggregation("collectd", cpuMultiLineChart("host"), { plugin: "cpu" }),
  memory: aggregation("collectd", multiLineChart("type_instance"), { plugin: "memory" }),
  swap: aggregation("collectd", multiLineChart("plugin_instance"), { plugin: "swap" }),

  // TODO figure out what to do with "tx" and "rx" values
  interfacesOctets: aggregation("collectd", multiLineChart("plugin_instance", "rx"), { plugin: "interface", collectd_type: "if_octets" }),
  interfacesPackets: aggregation("collectd", multiLineChart("plugin_instance", "rx"), { plugin: "interface", collectd_type: "if_packets" }),
  interfacesErrors: aggregation("collectd", multiLineChart("plugin_instance", "rx"), { plugin: "interface", collectd_type: "if_errors" }),

  connections: aggregation("collectd", table("plugin_instance", "type_instance"), { plugin: "tcpconns" }),

  responseTimeAverage: aggregation("syslog", sum({
    avg: {
      field: "response_time_ms"
    }
  }, 'ms'))
};
