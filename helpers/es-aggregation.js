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

function constructFilter(fromIso, toIso, hostname, extraTerms) {

  var filters = [{
    range: {
      "@timestamp": {
        gte: fromIso,
        lte: toIso,
        format: 'date_optional_time'
      }
    }
  }];

  if (hostname) filters.push({ term: { hostname: hostname }});
  if (extraTerms) {
    _(extraTerms).each(function (value, key) {
      var obj = {}; obj[key] = value; filters.push({ term: obj })
    });
  }

  return {
    filtered: { filter: { bool: { must: filters }}}
  };
}

function lineChart(aggs) {

  var aggregation = {
    "time": {
      date_histogram: {
        field: "@timestamp",
        interval: "1h" // TODO rhodri, auto calculate
      },
      aggregations: {
        "yAxis": aggs
      }
    }
  };

  function transform(results) {
    return results.aggregations.time.buckets.map(function (bucket) {
      return { x: bucket.key_as_string, y: bucket.yAxis.value };
    });
  }

  return { aggregation: aggregation, transform: transform };
}

function multiLineChart(splitField, valueField) {

  valueField = valueField || "value";

  var aggregation = {
    "time": {
      date_histogram: {
        field: "@timestamp",
        interval: "1h" // TODO rhodri, auto calculate
      },
      aggregations: {
        "lines": {
          terms: { field: splitField },
          aggregations: {
            "yAxis": { max: { field: valueField }}
          }
        }
      }
    }
  };

  function transform(results) {
    return results.aggregations.time.buckets.map(function (bucket) {
      return { x: bucket.key_as_string, y: bucket.lines.buckets.map(function (line) {
        return { key: line.key, value: line.yAxis[valueField] };
      }) };
    });
  }

  return { aggregation: aggregation, transform: transform };
}

function pieChart(field) {

  var aggregation = {
    "slices": { terms: { field: field }}
  };

  function transform(results) {
    return results.aggregations.slices.buckets.map(function (bucket) {
      return { x: bucket.key, y: bucket.doc_count };
    });
  }

  return { aggregation: aggregation, transform: transform };
}

function aggregation(type, aggs, terms) {

  return function(params) {

    var fromIso = moment(params.from).utc().toISOString(),
        toIso = moment(params.to).utc().toISOString();

    var options = constructOptions(type, {
      query: constructFilter(fromIso, toIso, params.hostname, terms),
      aggregations: aggs.aggregation
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

  cpu: aggregation("collectd", multiLineChart("type_instance"), { plugin: "cpu" }),
  memory: aggregation("collectd", multiLineChart("type_instance"), { plugin: "memory" }),
  swap: aggregation("collectd", multiLineChart("plugin_instance"), { plugin: "swap" })

  /* TODO too many questions about these, there are "tx" and "rx" values
  interfacesOctets: aggregation("collectd", multiLineChart("plugin_instance"), { plugin: "interface", collectd_type: "if_octets" }),
  interfacesPackets: aggregation("collectd", multiLineChart("plugin_instance"), { plugin: "interface", collectd_type: "if_packets" }),
  interfacesErrors: aggregation("collectd", multiLineChart("plugin_instance"), { plugin: "interface", collectd_type: "if_errors" })
  */

  // TODO table aggregation
};