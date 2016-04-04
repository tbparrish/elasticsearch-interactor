var hasHostsBuckets = require("../utils").hasHostsBuckets,
    mq = require("../metrics-query"),
    moment = require('moment');

function multiLineChart(filters) {
  function aggregation (from, to, interval) {
    return {
      hosts: {
        terms: {
          field: "appliance_hostname",
          "order": {
            "_term" : "asc"
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
      return results.aggregations.hosts.buckets.map(function (host) {
        return {key : host.key, values : transformMemoryStats(host.stats.buckets)};
      });
    }

  // TODO: look into calcaluting using script
  function transformMemoryStats(buckets) {
    var key = "", usedMemory = 0, i = 0, totalMemory = 0, stats = [];

    for (i = 0; i < buckets.used.time.buckets.length; i += 1) {
      key = buckets.used.time.buckets[i].key_as_string;

      usedMemory = buckets.used.time.buckets[i].stat.value;

      totalMemory = buckets.used.time.buckets[i].stat.value +
                    buckets.free.time.buckets[i].stat.value;

      if(usedMemory !== null && totalMemory !== null) {
        stats.push({x: key, y: (usedMemory/totalMemory)*100});
      }
    }
    return stats;
  }

  return { aggregation: aggregation, transform: transform };
}

function aggregation() {
  var aggs = multiLineChart(
    {used: {term: {type_instance: "used"}},
    free: {term: {type_instance: "free"}}});

  return function(params) {
    var fromIso = moment(params.from).utc().toISOString(),
        toIso = moment(params.to).utc().toISOString(),
        mustTerms = {type: "collectd", plugin: "memory"}, shouldTerms = [];

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
