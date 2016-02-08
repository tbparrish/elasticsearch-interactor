var hasHostsBuckets = require("../utils").hasHostsBuckets,
    mq = require("../metrics-query"),
    moment = require('moment');

function multiLineChart(filters) {
  function aggregation(from, to, interval) {
    return {
      hosts: {
        terms: {
          field: "appliance_ip"
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
                  interval: interval || "hour",
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
    if (!hasHostsBuckets(results))
      return [];

    var retVal = [], values = [],
        hostBuckets = results.aggregations.hosts.buckets;

    for(var i = 0; i < hostBuckets.length; i += 1) {
      var hostName = hostBuckets[i].key;
      var lastMessage = "";

      if(hostBuckets[i].messages.buckets.warning.doc_count === 0) {
          values.push({
            x: hostName,
            y: 0,
            tooltipTitle: hostName,
            tooltipContent: "There are no KSI Warnings"
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

    if(hostBuckets.length === 0) {
      return [];
    }

    retVal.push({key: "KSI Warnings", values: values});

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

function aggregation() {
  var aggs = multiLineChart(
    { warning: { term: { syslog_severity: "warning" }}});

  return function(params) {
    var fromIso = moment(params.from).utc().toISOString(),
        toIso = moment(params.to).utc().toISOString(),
        mustTerms = {type: "syslog"}, shouldTerms = [];

      if(params.appliance_ips) {
        if(Array.isArray(params.appliance_ips)) {
          params.appliance_ips.map(function(appliance_ip) {
              shouldTerms.push({appliance_ip: appliance_ip});
          });
        } else {
          mustTerms.appliance_ip = params.appliance_ips;
        }
      }

    var options = mq.constructOptions('syslog', {
      query: mq.constructFilter(null, null, mustTerms, shouldTerms),
      aggregations: aggs.aggregation(fromIso, toIso, params.interval)
    });

    return { options: options, transform: aggs.transform };
  };
}

module.exports = {
  aggregation: aggregation
};
