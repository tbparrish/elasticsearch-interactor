var hasHostsBuckets = require('../utils').hasHostsBuckets,
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

function multiLineChart(splitField) {
  function aggregation (from, to, interval, filters) {
    return {
       hosts: {
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
              stat: { avg: { field: "bl_cpu_stat" }}
            }
          }
        }
      }
    };
  }

  function transform(results) {
    if (!hasHostsBuckets(results))
      return [];
    return results.aggregations.hosts.buckets.map( function (host) {
      return { key: host.key, values: host.time.buckets.map(function(bucket){
        return {x: bucket.key_as_string, y: bucket.stat.value};
      })};
    });
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
  multiLineChart: multiLineChart,
  aggregation: aggregation
};
