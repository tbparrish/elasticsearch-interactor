var hasHostBuckets = require("../utils").hasHostBuckets;
function multiLineChart(splitField, _aggs) {
  function aggregation(from, to, interval) {
    return {
      hosts: {
        terms: {
          field: splitField
        },
        aggregations: {
          time: {
            date_histogram: {
              field: "@timestamp",
              interval: interval || 'hour',
              min_doc_count: 0,
              extended_bounds: {
                min: from,
                max: to
              }
            },
            aggregations: {
              stat: _aggs
            }
          }
        }
      }
    };
  }

  function transform(results) {
    if (!hasHostBuckets(results))
      return [];
    return results.aggregations.hosts.buckets.map(function(host) {
      return {
        key: host.key,
        values: host.time.buckets.map(function(bucket) {
          return {
            x: bucket.key_as_string,
            y: bucket.stat.value
          };
        })
      };
    });
  }

  return {
    aggregation: aggregation,
    transform: transform
  };
}

module.exports = {
  multiLineChart: multiLineChart
};
