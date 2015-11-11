function multiLineChart(splitField, valueField) {

  valueField = valueField || "value";

  function aggregation (from, to, interval) {
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
              rx: { avg: { field: "rx" }},
              tx: { avg: { field: "tx" }}
            }
          }
        }
      }
    };
  }

  // TODO: look into calcaluting using script
  function transform(results) {
    var key = null, idx = null, key_as_string = null,
        rxValues = [], txValues = [], retVal = [];
    var hosts = results.aggregations.hosts.buckets;

    for (var i = 0; i < hosts.length; i += 1 ) {
        key = hosts[i].key;

        rxValues = [];
        txValues = [];

        for (var j = 0;  j < hosts[i].time.buckets.length - 1; j += 1) {
          idx = j + 1;
          key_as_string = hosts[i].time.buckets[idx].key_as_string;

          rxValues.push({x: key_as_string,
            y: (hosts[i].time.buckets[idx].rx.value - hosts[i].time.buckets[j].rx.value)});
          txValues.push({x: key_as_string,
            y: (hosts[i].time.buckets[idx].tx.value - hosts[i].time.buckets[j].tx.value)});
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