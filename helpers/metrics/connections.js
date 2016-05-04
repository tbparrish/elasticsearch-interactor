var hasXBuckets = require("../utils").hasXBuckets,
    mq = require("../metrics-query"),
    moment = require('moment');

function table(x, y) {
  function aggregation (from, to, interval) {
    return {
      x: {
        terms: {
          field: x,
          size: "0",
          order: {
            _term : "asc"
          }
        },
        aggregations: {
          y: {
            terms: {
              field: y,
              order: {
                _term : "asc"
              }
             },
             aggregations: {
               time: {
                 date_histogram: {
                   field: "@timestamp",
                   interval: interval || "second",
                   min_doc_count: 1,
                   extended_bounds: {
                     min: from,
                     max: to
                   }
                 },
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
        }
      }
    };
  }

  function transform(results) {
    function getLastValue(buckets) {
      if(buckets.length === 0) {
        return 0;
      }

      return buckets[buckets.length-1].sum.value;
    }

    if(!hasXBuckets(results))
      return [];
    var keys = [ x ];
    var rows = [];
    results.aggregations.x.buckets.forEach(function (xBucket, i) {
      var row = {};
      row[x] = xBucket.key;
      xBucket.y.buckets.forEach(function (yBucket) {
        if (!i) {
          keys.push(yBucket.key);
        }
        row[yBucket.key] = getLastValue(yBucket.time.buckets);
      });
      rows.push(row);
    });

    return { keys: keys, rows: rows };
  }

  return { aggregation: aggregation, transform: transform };
}

function aggregation() {
  var aggs = table("plugin_instance", "type_instance");

  return function(params) {
    // go back the last 30 seconds.  Note: collectd sends messages every 10 seconds, therefore we should
    // have data available based on this window.
    var fromIso = moment(params.to).subtract(30, 'seconds').utc().toISOString(),
        toIso = moment(params.to).utc().toISOString(),
        mustTerms = {type: "collectd", plugin: "tcpconns"}, shouldTerms = [];
    if(params.appliance_hostnames) {
      if(Array.isArray(params.appliance_hostnames)) {
        params.appliance_hostnames.map(function(appliance_hostname) {
            shouldTerms.push({appliance_hostname: appliance_hostname});
        });
      } else {
        mustTerms.appliance_hostname = params.appliance_hostnames;
      }
    }

    var options = mq.constructOptions('collectd', {
      query: mq.constructFilter(fromIso, toIso, mustTerms, shouldTerms),
      aggregations: aggs.aggregation(fromIso, toIso, params.interval)
    });

    return { options: options, transform: aggs.transform };
  };
}

module.exports = {
  aggregation: aggregation
};
