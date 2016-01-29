var hasHostsBuckets = require("../utils").hasHostsBuckets,
    hasLinesBuckets = require("../utils").hasLinesBuckets;
function multiLineChart() {
  function aggregation (from, to, interval, filters, hostnames) {
    var isSingleHostAgg = false;

    if(hostnames) {
      if(Array.isArray(hostnames)) {
        if(hostnames.length === 0) {
          isSingleHostAgg = false;
        } else if(hostnames.length === 1) {
          isSingleHostAgg = true;
        } else {
          isSingleHostAgg = false;
        }
      } else {
        isSingleHostAgg = true;
      }
    }

    if(isSingleHostAgg) {
      return { // aggregation for one host
        lines: {
          terms: { field: "type_instance" },
          aggregations: {
            time: {
              date_histogram: {
                field: "@timestamp",
                interval: interval || 'hour',
                min_doc_count: 0,
                extended_bounds : {
                  min: from,
                  max: to
                }
              },
              aggregations: {
                yAxis: { max: { field: "value" }}
              }
            }
          }
        }
      };
    } else {
      return { // aggregation for multiple hosts
        hosts: {
          terms: { field: "appliance_ip" },
          aggregations : {
            stats: {
              filters: {
                  filters: filters
              },
              aggregations: {
                time: {
                  date_histogram: {
                    field: "@timestamp",
                    interval: interval || 'hour',
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
  }

  function transform(results) {
    var isSingleHostAgg = false;

    if(hasLinesBuckets(results)) {
      isSingleHostAgg = true;
    }

    if(isSingleHostAgg) { // transform for one host
      return results.aggregations.lines.buckets.map(function (line) {
        return { key: line.key, values: line.time.buckets.map(function (bucket) {
          return { x: bucket.key_as_string, y: bucket.yAxis.value };
        })};
      });
    } else { // transform for multiple hosts
      if (!hasHostsBuckets(results))
        return [];
      return results.aggregations.hosts.buckets.map(function (host) {
        return {key : host.key, values : transformMemoryStats(host.stats.buckets)};
      });
    }
  }

  // TODO: look into calcaluting using script
  function transformMemoryStats(buckets) {
    var key = "", usedMemory = 0, i = 0, totalMemory = 0, stats = [];

    for (i = 0; i < buckets.used.time.buckets.length; i += 1) {
      key = buckets.used.time.buckets[i].key_as_string;

      usedMemory = buckets.used.time.buckets[i].stat.value;

      totalMemory = buckets.used.time.buckets[i].stat.value +
                    buckets.free.time.buckets[i].stat.value;

      stats.push({x: key, y: (usedMemory/totalMemory)*100});

    }
    return stats;
  }

  return { aggregation: aggregation, transform: transform };
}

module.exports = {
  multiLineChart: multiLineChart
};
