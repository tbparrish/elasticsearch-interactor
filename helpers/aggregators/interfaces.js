var hasHostBuckets = require("../utils").hasHostBuckets;
function multiLineChart(splitField) {
  function aggregation (from, to, interval, _aggs) {
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
            aggregations: _aggs
          }
        }
      }
    };
  }

  // TODO: look into calcaluting using script
  function transform(results) {
    var key = "", idx = 0, key_as_string = "", i = 0, xValues = [], txValues = [], retVal = [];
    if (!hasHostBuckets(results))
      return [];
    var hosts = results.aggregations.hosts.buckets;

    for (i = 0; i < hosts.length; i += 1) {
        key = hosts[i].key;
        rxValues = [];
        txValues = [];

        for (var j = 0;  j < hosts[i].time.buckets.length - 1; j += 1) {
          idx = j + 1;

          key_as_string = hosts[i].time.buckets[idx].key_as_string;

          if((hosts[i].time.buckets[idx].rx.value !== null) && (hosts[i].time.buckets[j].rx.value !== null)) {
            if((hosts[i].time.buckets[idx].rx.value - hosts[i].time.buckets[j].rx.value) > 0) {
              rxValues.push({x: key_as_string,
                y: (hosts[i].time.buckets[idx].rx.value - hosts[i].time.buckets[j].rx.value)});
            }
          }

          if((hosts[i].time.buckets[idx].tx.value !== null) && (hosts[i].time.buckets[j].tx.value !== null)) {
            if((hosts[i].time.buckets[idx].tx.value - hosts[i].time.buckets[j].tx.value) > 0) {
              txValues.push({x: key_as_string,
                y: (hosts[i].time.buckets[idx].tx.value - hosts[i].time.buckets[j].tx.value)});
            }
          }

        }
        retVal.push({ key: key+" rx", values: rxValues});
        retVal.push({ key: key+" tx", values: txValues});
      }
      return retVal;
    }
    return { aggregation: aggregation, transform: transform };
}

module.exports = {
  multiLineChart: multiLineChart
};
