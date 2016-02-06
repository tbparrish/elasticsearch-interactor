var hasHostsBuckets = require("../utils").hasHostsBuckets,
    moment = require('moment'),
    _ = require('lazy.js');

function constructOptions(type, body) {
  return {
    index: 'overwatch-*',
    search_type: 'count',
    type: type,
    ignore_unavailable: true,
    body: _(body).defaults({ size: 0 }).toObject()
  };
}

function constructFilter(fromIso, toIso, appliance_ips, extraTerms, shouldTerms) {
  var shouldFilters = [];
  var mustFilters = [];

  if (extraTerms) {
    _(extraTerms).each(function (value, key) {
      var obj = {}; obj[key] = value; mustFilters.push({ term: obj });
    });
  }

  if(appliance_ips) {
    if(Array.isArray(appliance_ips)) {
      appliance_ips.map(function(appliance_ip) {
          var obj = {}; obj.host = appliance_ip; shouldFilters.push({ term: obj });
      });
    } else {
      mustFilters.push({ term: { host: appliance_ips }});
    }
  }

  if(shouldTerms) {
    if(shouldTerms.length > 0) {
      shouldTerms.map(function(shouldTerm) {
          var obj = {}; obj = shouldTerm; shouldFilters.push({ term: obj });
      });
    }
  }

  if((mustFilters.length > 0) && (shouldFilters.length > 0 )) {
    return {
      filtered: { filter: { bool: { must: mustFilters, should: shouldFilters }}}
    };
  } else if((mustFilters.length > 0) && (shouldFilters.length === 0 )){
    return {
      filtered: { filter: { bool: { must: mustFilters }}}
    };
  } else if((mustFilters.length === 0) && (shouldFilters.length > 0 )){
    return {
      filtered: { filter: { bool: { must: shouldFilters }}}
    };
  }
}

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
    if (!hasHostsBuckets(results))
      return [];
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
      return [];
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

function aggregation(type, aggs, terms, filters, shouldTerms) {

  return function(params) {

    var fromIso = moment(params.from).utc().toISOString(),
        toIso = moment(params.to).utc().toISOString();

    var options = constructOptions(type, {
      query: constructFilter(fromIso, toIso, params.appliance_ips, terms, shouldTerms),
      aggregations: aggs.aggregation(fromIso, toIso, params.interval, filters, params.appliance_ips)
    });

    return { options: options, transform: aggs.transform };
  };
}

module.exports = {
  multiLineChart: multiLineChart,
  aggregation: aggregation
};
