function multiLineChart(splitField, key, filters) {
  function aggregation(from, to, interval) {
    return {
      hosts: {
        terms: {
          field: splitField
        },
        aggregations: {
          messages: {
            filters: {
              filters: filters
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
        }
      }
    };
  }

  function transform(results) {
    var retVal = [];
    var values = [];
    var hostBuckets = results.aggregations.hosts.buckets;

    for(var i = 0; i < hostBuckets.length; i += 1) {
      var hostName = hostBuckets[i].key;
      var lastMessage = "";

      if(key === "KSI Service Errors") {
        if((hostBuckets[i].messages.buckets.emergency.doc_count === 0) &&
           (hostBuckets[i].messages.buckets.alert.doc_count === 0) &&
           (hostBuckets[i].messages.buckets.critical.doc_count === 0) &&
           (hostBuckets[i].messages.buckets.error.doc_count === 0)) {
             values.push({
               x: hostName,
               y: 0,
               tooltipTitle: hostName,
               tooltipContent: "There are no "+key
             });
        } else {
            var buckets;
            if(hostBuckets[i].messages.buckets.emergency.doc_count > 0) {
              buckets = hostBuckets[i].messages.buckets.emergency.time.buckets;
            } else if(hostBuckets[i].messages.buckets.alert.doc_count > 0) {
              buckets = hostBuckets[i].messages.buckets.alert.time.buckets;
            } else if (hostBuckets[i].messages.buckets.critical.doc_count > 0) {
              buckets = hostBuckets[i].messages.buckets.critical.time.buckets;
            } else {
              buckets = hostBuckets[i].messages.buckets.error.time.buckets;
            }
            lastMessage = getLastMessage(buckets);
            values.push({
              x: hostName,
              y: (hostBuckets[i].messages.buckets.emergency.doc_count+
                  hostBuckets[i].messages.buckets.alert.doc_count+
                  hostBuckets[i].messages.buckets.critical.doc_count+
                  hostBuckets[i].messages.buckets.error.doc_count),
              tooltipTitle: hostName,
              tooltipContent: lastMessage
            });
        }
      }

      if(key === "KSI Service Warnings") {
        if(hostBuckets[i].messages.buckets.warning.doc_count === 0) {
            values.push({
              x: hostName,
              y: 0,
              tooltipTitle: hostName,
              tooltipContent: "There are no "+key
            });
        } else {
            lastMessage = getLastMessage(hostBuckets[i].messages.buckets.warning.time.buckets);
            values.push({
              x: hostName,
              y: hostBuckets[i].messages.buckets.warning.doc_count,
              tooltipTitle: hostName,
              tooltipContent: lastMessage
          });
        }
      }
    }

    if(hostBuckets.length === 0) {
      values.push({
        x: "No "+key,
        y: hostBuckets.length,
        tooltipTitle: "No "+key,
        tooltipContent: "There are no "+key
      });
    }

    retVal.push({key: key, values: values});

    return retVal;
  }

  function getLastMessage(buckets) {
    var message = "";

    for(var i = buckets.length-1; i >= 0; i--) {
      if(buckets[i].doc_count > 0) {
        message = buckets[i].message.buckets[0].key;
        return message;
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
