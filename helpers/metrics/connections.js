var hasXBuckets = require("../utils").hasXBuckets,
    mq = require("../metrics-query"),
    moment = require('moment');

function table(x, y) {
  function aggregation () {
    return {
      x: {
        terms: { field: x, size: "0" },
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

function aggregation() {
  var aggs = table("plugin_instance", "type_instance");

  return function(params) {
    var fromIso = moment(params.from).utc().toISOString(),
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
      aggregations: aggs.aggregation()
    });

    return { options: options, transform: aggs.transform };
  };
}

module.exports = {
  aggregation: aggregation
};
