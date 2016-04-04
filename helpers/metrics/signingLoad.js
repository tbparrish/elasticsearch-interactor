var hasHostsBuckets = require("../utils").hasHostsBuckets,
    mq = require("../metrics-query"),
    moment = require('moment');

function multiLineChart() {
  function aggregation(from, to, interval) {
    return {
      hosts: {
        terms: {
          field: "appliance_hostname",
          "order": {
            "_term" : "asc"
          }
        },
        aggregations: {
          request_count: {
            stats : { field : "request_count" } }
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
      if(hosts[idx].request_count && hosts[idx].request_count.min) {
        data[0].values.push(
          {x: hosts[idx].key,tooltipTitle: hosts[idx].key, y: Math.floor(hosts[idx].request_count.min)});
      } else {
        data[0].values.push(
          {x: hosts[idx].key,tooltipTitle: hosts[idx].key, y: 0});
      }

      if(hosts[idx].request_count && hosts[idx].request_count.avg) {
        data[1].values.push(
          {x: hosts[idx].key,tooltipTitle: hosts[idx].key, y: Math.floor(hosts[idx].request_count.avg)});
      } else {
        data[1].values.push(
          {x: hosts[idx].key,tooltipTitle: hosts[idx].key, y: 0});
      }

      if(hosts[idx].request_count && hosts[idx].request_count.max) {
        data[2].values.push(
          {x: hosts[idx].key,tooltipTitle: hosts[idx].key, y: Math.floor(hosts[idx].request_count.max)});
      } else {
        data[2].values.push(
          {x: hosts[idx].key,tooltipTitle: hosts[idx].key, y: 0});
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

    if(params.appliance_hostnames) {
      if(Array.isArray(params.appliance_hostnames)) {
        params.appliance_hostnames.map(function(appliance_hostname) {
            shouldTerms.push({appliance_hostname: appliance_hostname});
        });
      } else {
        mustTerms.appliance_hostname = params.appliance_hostnames;
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
