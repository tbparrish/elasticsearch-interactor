
var hasHostsBuckets = require("../utils").hasHostsBuckets,
    mq = require("../metrics-query"),
    moment = require('moment');

function lineChart(aggs) {
  function aggregation (from, to, interval) {
    return {
       hosts: {
        terms: { field: "appliance_ip" },
         aggregations : {
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
      }
    }
  };
  }

  function transform(results) {
    if(!hasHostsBuckets(results))
      return [];
     return results.aggregations.hosts.buckets.map(function (host) {
      return {
        key: host.key,
        values: host.time.buckets.map(function(bucket) {
          return {
            x: bucket.key_as_string,
            y: bucket.yAxis.value
          };
        })
      };
    });
  }

  return { aggregation: aggregation, transform: transform };
}

function aggregation() {
  var aggs = lineChart(
    { max: { field: "request_count"}});

  return function(params) {
    var fromIso = moment(params.from).utc().toISOString(),
        toIso = moment(params.to).utc().toISOString(),
        mustTerms = {type: "syslog"}, shouldTerms = [];

    if(params.appliance_ips) {
      if(Array.isArray(params.appliance_ips)) {
        params.appliance_ips.map(function(appliance_ip) {
            shouldTerms.push({appliance_ip: appliance_ip});
        });
      } else {
        mustTerms.appliance_ip = params.appliance_ips;
      }
    }

    var options = mq.constructOptions('syslog', {
      query: mq.constructFilter(fromIso, toIso, mustTerms, shouldTerms),
      aggregations: aggs.aggregation(fromIso, toIso, params.interval)
    });

    return { options: options, transform: aggs.transform };
  };
}

module.exports = {
  aggregation: aggregation
};
