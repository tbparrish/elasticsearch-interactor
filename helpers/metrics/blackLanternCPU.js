var hasHostsBuckets = require('../utils').hasHostsBuckets,
    mq = require("../metrics-query"),
    moment = require('moment'),
    _ = require('lazy.js');

function multiLineChart() {
  function aggregation (from, to, interval) {
    return {
       hosts: {
        terms: { field: "appliance_ip" },
        aggregations: {
          time: {
            date_histogram: {
              field: "@timestamp",
              interval: interval || "hour",
              min_doc_count: 0,
              extended_bounds : {
                min: from,
                max: to
              }
            },
            aggregations: {
              stat: { avg: { field: "bl_cpu_stat" }}
            }
          }
        }
      }
    };
  }

  function transform(results) {
    if (!hasHostsBuckets(results))
      return [];
    return results.aggregations.hosts.buckets.map( function (host) {
      return { key: host.key, values: host.time.buckets.map(function(bucket){
        return { x: bucket.key_as_string, y: bucket.stat.value };
      })};
    });
  }

  return { aggregation: aggregation, transform: transform };
}

function aggregation() {
  var aggs = multiLineChart();

  return function(params) {
    var fromIso = moment(params.from).utc().toISOString(),
        toIso = moment(params.to).utc().toISOString(),
        mustTerms = {message_type: "BL_CPU_STAT"},
        shouldTerms = [],
        appl;

      if(params.appliances) {
        if(Array.isArray(params.appliances)) {
          for(var i = 0; i < params.appliances.length; i++) {
            appl  = JSON.parse(params.appliances[i]);
            if(appl.type === 'blackLantern') {
              shouldTerms.push({appliance_ip: appl.ip});
            }
          }
        } else {
          appl = JSON.parse(params.appliances);
          if(appl.type === 'blackLantern') {
            mustTerms.appliance_ip = appl.ip;
          }
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
