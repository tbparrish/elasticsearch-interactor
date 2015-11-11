function multiLineChart(splitField, valueField) {

  valueField = valueField || "value";

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
                  stat: { avg: { field: valueField }}
                }
              }
            }
          }
        }
      }
    };
  }

  function transform(results) {
    return results.aggregations.hosts.buckets.map( function (host) {
      return { key: host.key, values: transformCpuStats(host.stats.buckets)};
    });
  }

  // TODO: look into calcaluting using script
  function transformCpuStats(buckets) {
    var key = "",
        idle = 0,
        tempValue = 0,
        stats = [];

      for (var i = 0; i < buckets.user.time.buckets.length; i += 1) {
        key = buckets.user.time.buckets[i].key_as_string;
        idle = buckets.idle.time.buckets[i].stat.value;
        tempValue = buckets.user.time.buckets[i].stat.value +
                   buckets.nice.time.buckets[i].stat.value +
                   buckets.system.time.buckets[i].stat.value;

        stats.push({ x: key, y: ((tempValue)/(tempValue+idle))*100});
      }
      return stats;
    }

  return { aggregation: aggregation, transform: transform };
}

module.exports = {
  multiLineChart: multiLineChart
};
