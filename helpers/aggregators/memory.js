function multiLineChart(splitField) {
  function aggregation (from, to, interval, filters) {
    return {
      hosts: {
        terms: { field: splitField },
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

  function transform(results) {
    return results.aggregations.hosts.buckets.map(function (host) {
      return {key : host.key, values : transformMemoryStats(host.stats.buckets)};
    });
  }

  // TODO: look into calcaluting using script
  function transformMemoryStats(buckets) {
    var key = "", usedMemory = 0, i = 0, totalMemory = 0, stats = [];

    for (i = 0; i < buckets.used.time.buckets.length; i += 1) {

      // filter falsy data from calculation.
      if(buckets.used.time.buckets[i].stat.value && buckets.free.time.buckets[i].stat.value) {
        key = buckets.used.time.buckets[i].key_as_string;

        usedMemory = buckets.used.time.buckets[i].stat.value;

        totalMemory = buckets.used.time.buckets[i].stat.value +
                      buckets.free.time.buckets[i].stat.value;

        stats.push({x: key, y: (usedMemory/totalMemory)*100});
      }
    }
    return stats;
  }
  return { aggregation: aggregation, transform: transform };
}

module.exports = {
  multiLineChart: multiLineChart
};
