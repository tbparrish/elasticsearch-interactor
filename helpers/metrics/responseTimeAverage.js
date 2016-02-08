var hasTimeBuckets = require("../utils").hasTimeBuckets,
    mq = require("../metrics-query"),
    moment = require('moment');

function sum(aggs, unit) {
  function aggregation () {
    return {
      time: aggs
    };
  }

  function transform(results) {
    if(!hasTimeBuckets(results))
      return [];
    return { value: results.aggregations.time.value, unit: unit };
  }

  return { aggregation: aggregation, transform: transform };
}

function aggregation() {
  var aggs = sum({avg: {field: "response_time_ms"}}, "ms");

  return function(params) {
    var fromIso = moment(params.from).utc().toISOString(),
        toIso = moment(params.to).utc().toISOString(),
        mustTerms = {type: "syslog" }, shouldTerms = [];

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