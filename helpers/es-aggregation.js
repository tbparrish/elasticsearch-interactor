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

function constructFilter(fromIso, toIso, hostname, terms) {

  var terms = hostname || terms
              ? _(terms || {}).assign({ hostname: hostname }).toObject()
              : void(0);

  return {
    filtered: { filter: { bool: { must: {
      range: {
        "@timestamp": {
          gte: fromIso,
          lte: toIso,
          format: 'date_optional_time'
        }
      },
      term: terms
    }}}}
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

function aggregation(type, aggs) {

  return function(params) {

    var fromIso = moment(params.from).utc().toISOString(),
        toIso = moment(params.to).utc().toISOString();

    var options = constructOptions(type, {
      query: constructFilter(fromIso, toIso, params.hostname),
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
  errorReason: aggregation("syslog", pieChart("error_reason"))

};