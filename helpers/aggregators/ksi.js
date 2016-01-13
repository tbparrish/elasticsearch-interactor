function multiLineChart(splitField, key) {
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
              message: {
                terms: {
                  field: "message"
                }
              }
            }
          }
        }
      }
    };
  }

  function transform(results) {
    var retVal = [];
    var values = [];
    var buckets = results.aggregations.hosts.buckets;

    for(var i = 0; i < buckets.length; i++) {
      if(buckets[i].doc_count > 0) {
        values.push({
          x: buckets[i].key,
          y: buckets[i].doc_count,
          tooltipTitle: buckets[i].key,
          tooltipContent: getLastMessage(buckets[i].time.buckets)
        });
      }
    }

    if(buckets.length === 0) {
      values.push({
        x: "No "+key,
        y: buckets.length,
        tooltipTitle: "No "+key,
        tooltipContent: "There are no "+key
      });
    }

    retVal.push({key: key, values: values});

    return retVal;
  }

  function getLastMessage(buckets) {
    var message = "";

    for(var i = 0; i < buckets.length; i++) {
      if(buckets[i].message.buckets.length > 0) {
        message = buckets[i].message.buckets[0].key;
      }
    }

    return message;
  }

  return {
    aggregation: aggregation,
    transform: transform
  };
}

module.exports = {
  multiLineChart: multiLineChart
};
