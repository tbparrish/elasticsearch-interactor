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
      values.push({
        x: hostName,
        y: (hostBuckets[i].messages.buckets.allParentFailure.doc_count+
            hostBuckets[i].messages.buckets.ksiRequestRejected.doc_count+
            hostBuckets[i].messages.buckets.ksiResponseRejected.doc_count+
            hostBuckets[i].messages.buckets.ksiAuthAlert.doc_count+
            hostBuckets[i].messages.buckets.udpMessageDrop.doc_count+
            hostBuckets[i].messages.buckets.extenderServiceDown.doc_count)
      });
    }
    
    retVal.push({key: "Alerts", values: values});

    return retVal;
  }

  return {
    aggregation: aggregation,
    transform: transform
  };
}

function aggregation() {
  var aggs = multiLineChart(
    {allParentFailure: { term: { alert_type: "ALL_PARENT_FAILURE" }},
    ksiRequestRejected: { term: { alert_type: "KSI_REQUEST_REJECTED" }},
    ksiResponseRejected: {term: { alert_type: "KSI_RESPONSE_REJECTED"}},
    ksiAuthAlert: {term: {alert_type: "KSI_AUTH_ALERT"}},
    udpMessageDrop: {term: {alert_type: "UDP_MESSAGE_DROP"}},
    extenderServiceDown: {term: {alert_type: "EXTENDER_SERVICE_DOWN"}}});

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
      query: mq.constructFilter(fromIso, toIso, mustTerms, shouldTerms),
      aggregations: aggs.aggregation(fromIso, toIso, params.interval)
    });

    return { options: options, transform: aggs.transform };
  };
}

module.exports = {
  aggregation: aggregation
};
