var hasHostsBuckets = require('../utils').hasHostsBuckets,
    mq = require("../metrics-query"),
    moment = require('moment'),
    _ = require('lazy.js');

function multiLineChart(filters) {
  function aggregation (from, to, interval) {
    return {
       hosts: {
         terms: {
           field: "appliance_hostname",
           size: "0",
           order: {
             _term : "asc"
           }
         },
        aggregations : {
           stats: {
            filters: {
              filters: filters
            },
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
                  stat: { avg: { field: "value" }}
                }
              }
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
      return { key: host.key, values: transformCpuStats(host.stats.buckets)};
    });
  }

  // TODO: look into calcaluting using script
  function transformCpuStats(buckets) {
    var key = "", i = 0, idle = 0, tempValue = 0, stats = [];

      for (i = 0; i < buckets.user.time.buckets.length-1; i += 1) {
        key = buckets.user.time.buckets[i+1].key_as_string;

        if((buckets.idle.time.buckets[i].stat.value !== null) &&
           (buckets.user.time.buckets[i].stat.value !== null) &&
           (buckets.nice.time.buckets[i].stat.value !== null) &&
           (buckets.system.time.buckets[i].stat.value !== null) &&
           (buckets.idle.time.buckets[i+1].stat.value !== null) &&
           (buckets.user.time.buckets[i+1].stat.value !== null) &&
           (buckets.nice.time.buckets[i+1].stat.value !== null) &&
           (buckets.system.time.buckets[i+1].stat.value !== null)) {

          idle = (buckets.idle.time.buckets[i+1].stat.value - buckets.idle.time.buckets[i].stat.value);

          tempValue = (buckets.user.time.buckets[i+1].stat.value   - buckets.user.time.buckets[i].stat.value) +
                      (buckets.nice.time.buckets[i+1].stat.value   - buckets.nice.time.buckets[i].stat.value) +
                      (buckets.system.time.buckets[i+1].stat.value - buckets.system.time.buckets[i].stat.value);

          stats.push({ x: key, y: Math.floor((tempValue)/(tempValue+idle))*100});
        }
      }
      return stats;
    }
  return { aggregation: aggregation, transform: transform };
}

function aggregation() {
  var aggs = multiLineChart({user: {term: {type_instance: "user"}}, nice: {term: {type_instance: "nice"}},
                system: {term: {type_instance: "system"}}, idle: {term: {type_instance: "idle"}}});

  return function(params) {
    var fromIso = moment(params.from).utc().toISOString(),
        toIso = moment(params.to).utc().toISOString(),
        mustTerms = {plugin: 'cpu' },
        shouldTerms = [],
        appl;

      if(params.appliances) {
        if(Array.isArray(params.appliances)) {
          for(var i = 0; i < params.appliances.length; i++) {
            appl  = JSON.parse(params.appliances[i]);
            if(appl.type === 'videri') {
              shouldTerms.push({appliance_hostname: appl.hostname});
            }
          }
        } else {
          appl = JSON.parse(params.appliances);
          if(appl.type === 'videri') {
            mustTerms.appliance_hostname = appl.hostname;
          }
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
