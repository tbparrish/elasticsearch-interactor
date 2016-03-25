var hasHostsBuckets = require("../utils").hasHostsBuckets,
    mq = require("../metrics-query"),
    moment = require('moment'),
    transformInterface = require("./transformInterface");

function multiLineChart(_aggs) {
  function aggregation (from, to, interval) {
    return {
       hosts: {
        terms: { field: "appliance_hostname" },
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
            aggregations: _aggs
          }
        }
      }
    };
  }

  function transform(results) {
    if (!hasHostsBuckets(results)) {
      return [];
    } else {
      return transformInterface.transform(results);
    }
  }

  return { aggregation: aggregation, transform: transform };
}

function aggregation() {
  var aggs = multiLineChart({rx: {avg: {field: "rx"}}, tx: {avg: {field: "tx"}}});

  return function(params) {
    var fromIso = moment(params.from).utc().toISOString(),
        toIso = moment(params.to).utc().toISOString(),
        mustTerms = {type: "collectd", plugin: "interface",
        collectd_type: "if_octets" }, shouldTerms = [];

    if(params.appliance_hostnames) {
      if(Array.isArray(params.appliance_hostnames)) {
        params.appliance_hostnames.map(function(appliance_hostname) {
            shouldTerms.push({appliance_hostname: appliance_hostname});
        });
      } else {
        mustTerms.appliance_hostname = params.appliance_hostnames;
      }
    }

    var options = mq.constructOptions('collectd', {
      query: mq.constructFilter(fromIso, toIso, mustTerms, shouldTerms),
      aggregations: aggs.aggregation(fromIso, toIso, params.interval)
    });

    return { options: options, transform: aggs.transform };
  };
}

module.exports = {
  aggregation: aggregation
};
