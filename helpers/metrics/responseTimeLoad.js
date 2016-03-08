var hasHostsBuckets = require("../utils").hasHostsBuckets,
    mq = require("../metrics-query"),
    moment = require('moment');

function multiLineChart() {
  function aggregation(from, to, interval) {
    return {
      hosts: {
        terms: {
          field: "appliance_ip"
        },
        aggregations: {
          response_time: {
            stats : { field : "response_time_ms" } }
        }
      }
    };
  }

  function transform(results) {
    if(!hasHostsBuckets(results))
      return [];

    var data = [];

    data.push({key: "Minimum", values: []});
    data.push({key: "Average", values: []});
    data.push({key: "Maximum", values: []});

    var hosts = results.aggregations.hosts.buckets;
    for(var idx = 0; idx < hosts.length; idx +=1) {
      if(hosts[idx].key && hosts[idx].response_time.min &&
        hosts[idx].response_time.avg && hosts[idx].response_time.max) {
      data[0].values.push(
        {x: hosts[idx].key,tooltipTitle: hosts[idx].key, y: hosts[idx].response_time.min});
      data[1].values.push(
        {x: hosts[idx].key,tooltipTitle: hosts[idx].key, y: hosts[idx].response_time.avg});
      data[2].values.push(
        {x: hosts[idx].key,tooltipTitle: hosts[idx].key, y: hosts[idx].response_time.max});
      }
    }

    if( data[0].values.length === 0 &&
        data[1].values.length === 0 &&
        data[2].values.length === 0) {
      return [];
    }

    return data;
  }

  return { aggregation: aggregation, transform: transform };
}

function aggregation() {
  var aggs = multiLineChart();

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
