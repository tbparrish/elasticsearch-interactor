var moment = require('moment'),
    _ = require('lazy.js'),
    hasLinesBuckets = require('./utils').hasLinesBuckets,
    hasTimeBuckets = require('./utils').hasTimeBuckets,
    hasXBuckets = require('./utils').hasXBuckets,
    hasSlicesBuckets = require('./utils').hasSlicesBuckets,
    memoryMetrics = require('./metrics/memory'),
    swapMetrics = require('./metrics/swap'),
    interfacesErrorsMetrics = require('./metrics/interfacesErrors'),
    interfacesOctetsMetrics = require('./metrics/interfacesOctets'),
    interfacesPacketsMetrics = require('./metrics/interfacesPackets'),
    connectionsMetrics = require('./metrics/connections'),
    connectionsMetrics = require('./metrics/connections'),
    ksiErrorsMetrics = require('./metrics/ksiErrors'),
    ksiWarningsMetrics = require('./metrics/ksiWarnings'),
    responseTimeMetrics = require('./metrics/responseTime'),
    signaturesMetrics = require('./metrics/signatures'),
    errorMessageMetrics = require('./metrics/errorMessage'),
    errorReasonMetrics = require('./metrics/errorMessage'),
    videriCPUMetrics = require('./metrics/videriCPU'),
    blackLanternCPUMetrics = require('./metrics/blackLanternCPU'),
    responseTimeAverageMetrics = require('./metrics/responseTimeAverage'),
    responseTimeLoadMetrics = require('./metrics/responseTimeLoad');

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

  var mustFilters = [{
    range: {
      "@timestamp": {
        gte: fromIso,
        lte: toIso,
        format: 'date_optional_time'
      }
    }
  }];

  if (extraTerms) {
    _(extraTerms).each(function (value, key) {
      var obj = {}; obj[key] = value; mustFilters.push({ term: obj });
    });
  }

  if(appliance_ips) {
    if(Array.isArray(appliance_ips)) {
      appliance_ips.map(function(appliance_ip) {
          var obj = {}; obj.appliance_ip = appliance_ip; shouldFilters.push({ term: obj });
      });
    } else {
      mustFilters.push({ term: { appliance_ip: appliance_ips }});
    }
  }

  if(shouldTerms) {
    if(shouldTerms.length > 0) {
      shouldTerms.map(function(shouldTerm) {
          var obj = {}; obj = shouldTerm; shouldFilters.push({ term: obj });
      });
    }
  }

  if(shouldFilters.length === 0) {
    return {
      filtered: { filter: { bool: { must: mustFilters }}}
    };
  } else {
    return {
      filtered: { filter: { bool: { must: mustFilters, should: shouldFilters }}}
    };
  }
}

function lineChart(aggs) {

  function aggregation (from, to, interval) {
    return {
       time: {
        date_histogram: {
          field: "@timestamp",
          interval: interval || "minute", // TODO rhodri, auto calculate,
          min_doc_count: 0,
          extended_bounds : {
            min: from,
            max: to
          }
        },
        aggregations: {
          yAxis: aggs
        }
      }
    };
  }

  function transform(results) {
    if(!hasTimeBuckets(results))
      return [];
    return [{
      values: results.aggregations.time.buckets.map(function (bucket) {
        return { x: bucket.key_as_string, y: bucket.yAxis.value };
      })
    }];
  }

  return { aggregation: aggregation, transform: transform };
}

function multiLineChart(splitField, valueField) {

  valueField = valueField || "value";

  function aggregation (from, to, interval) {
    return {
      lines: {
        terms: { field: splitField },
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
              yAxis: { max: { field: valueField }}
            }
          }
        }
      }
    };
  }

  function transform(results) {
    if(!hasLinesBuckets(results))
      return [];
    return results.aggregations.lines.buckets.map(function (line) {
      return { key: line.key, values: line.time.buckets.map(function (bucket) {
        return { x: bucket.key_as_string, y: bucket.yAxis.value };
      })};
    });
  }

  return { aggregation: aggregation, transform: transform };
}

function sum(aggs, unit) {

  function aggregation () {
    return {
      time: aggs
    };
  }

  function transform(results) {
    if(!hasTimeBuckets(results))
      return [];
    return { value: results.aggregations.time.value, unit: unit };
  }

  return { aggregation: aggregation, transform: transform };
}

function pieChart(field) {

  function aggregation () {
    return {
      slices: { terms: { field: field } }
    };
  }

  function transform(results) {
    if(!hasSlicesBuckets(results))
      return [];
    return results.aggregations.slices.buckets.map(function (bucket) {
      return { x: bucket.key, y: bucket.doc_count };
    });
  }

  return { aggregation: aggregation, transform: transform };
}

function table(x, y) {

  function aggregation () {
    return {
      x: {
        terms: { field: x },
        aggregations: {
          y: {
            terms: { field: y },
            aggregations: {
              sum: {
                sum: {
                  field: "value"
                }
              }
            }
          }
        }
      }
    };
  }

  function transform(results) {
    if(!hasXBuckets(results))
      return [];
    var keys = [ x ];
    var rows = [];
    results.aggregations.x.buckets.forEach(function (xBucket, i) {
      var row = {};
      row[x] = xBucket.key;
      xBucket.y.buckets.forEach(function (yBucket) {
        if (!i) { keys.push(yBucket.key); }
        row[yBucket.key] = yBucket.sum.value;
      });
      rows.push(row);
    });

    return { keys: keys, rows: rows };
  }

  return { aggregation: aggregation, transform: transform };
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
  ksiErrors: ksiErrorsMetrics.aggregation(),
  ksiWarnings: ksiWarningsMetrics.aggregation(),
  responseTime: responseTimeMetrics.aggregation(),
  signatures: signaturesMetrics.aggregation(),
  errorMessage: errorMessageMetrics.aggregation(),
  errorReason: errorReasonMetrics.aggregation(),
  videriCPU: videriCPUMetrics.aggregation(),
  blackLanternCPU: blackLanternCPUMetrics.aggregation(),
  memory: memoryMetrics.aggregation(),
  swap: swapMetrics.aggregation(),
  interfacesOctets: interfacesOctetsMetrics.aggregation(),
  interfacesPackets: interfacesPacketsMetrics.aggregation(),
  interfacesErrors: interfacesErrorsMetrics.aggregation(),
  connections: connectionsMetrics.aggregation(),
  responseTimeAverage: responseTimeAverageMetrics.aggregation(),
  responseTimeLoad: responseTimeLoadMetrics.aggregation()
};
