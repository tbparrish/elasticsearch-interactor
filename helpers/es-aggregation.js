var moment = require('moment');

function constructOptions(type, body) {
  return {
    index: 'overwatch-*',
    search_type: 'count',
    type: type || 'syslog',
    ignore_unavailable: true,
    body: _(body).defaults({ size: 0 }).toObject()
  };
}

function constructFilter(fromIso, toIso, hostname, terms) {

  var terms = hostname || terms
              ? _(terms || {}).assign({ hostname: hostname }).toObject()
              : void(0);

  return {
    filtered: {
      filter: {
        bool: {
          must: {
            range: {
              "@timestamp": {
                gte: fromIso,
                lte: toIso,
                format: 'date_optional_time'
              }
            },
            term: terms
          }
        }
      }
    }
  };
}

function constructAggs(aggs) {
  return {
    "time": {
      date_histogram: {
        field: "@timestamp",
        interval: "1h" // TODO rhodri, auto calculate
      },
      aggregations: aggs
    }
  };
}

function responseTimeAggregation(params) {
  var fromIso = moment(params.from).utc().toISOString(),
      toIso = moment(params.to).utc().toISOString();
  return constructOptions("syslog", {
    query: constructFilter(fromIso, toIso, params.hostname),
    aggregations: constructAggs({
      "responseTime": {
        avg: {
          field: "response_time_ms"
        }
      }
    })  
  });
}

module.exports = {
  responseTime: responseTimeAggregation
};