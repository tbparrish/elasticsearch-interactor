var moment = require('moment');

// TODO - make promises to calculate rx and tx asynchronously
var transform = function(results, interval) {
  var key = "", startingIdx = 0, startTime, endTime, endingIdx = 1, seconds = 0, key_as_string = "", i = 0, xValues = [], txValues = [], retVal = [];
  var hosts = results.aggregations.hosts.buckets;
  var truncatedBuckets = interval === 'minute'? 2: 1;

  for (i = 0; i < hosts.length; i += 1) {
      key = hosts[i].key;
      rxValues = [];

      endingIdx = 1;
      for (startingIdx = 0;  (startingIdx < hosts[i].time.buckets.length - 1) && (endingIdx < hosts[i].time.buckets.length - truncatedBuckets); startingIdx += 1) {

        // find starting index
        while((startingIdx < hosts[i].time.buckets.length - 1) && (endingIdx < hosts[i].time.buckets.length) &&
              ((typeof hosts[i].time.buckets[startingIdx].rx.value === "undefined") || (hosts[i].time.buckets[startingIdx].rx.value === null) ||
              (typeof hosts[i].time.buckets[startingIdx].key_as_string === "undefined") || (hosts[i].time.buckets[startingIdx].key_as_string === null))) {
                startingIdx += 1;
                endingIdx = startingIdx+1;
        }

        // find ending index
        while( (endingIdx < hosts[i].time.buckets.length) &&
              (
                typeof hosts[i].time.buckets[endingIdx].rx.value === "undefined" ||
                hosts[i].time.buckets[endingIdx].rx.value === null ||
                typeof hosts[i].time.buckets[endingIdx].key_as_string === "undefined" ||
                hosts[i].time.buckets[endingIdx].key_as_string === null
            )) {
            endingIdx += 1;
        }

        // make sure we have a positive value
        while((endingIdx < hosts[i].time.buckets.length) &&
              ((hosts[i].time.buckets[endingIdx].rx.value - hosts[i].time.buckets[startingIdx].rx.value) < 0)) {
            endingIdx += 1;
        }

        if((startingIdx < hosts[i].time.buckets.length - 1) && (endingIdx < hosts[i].time.buckets.length) &&
          (hosts[i].time.buckets[endingIdx].rx.value - hosts[i].time.buckets[startingIdx].rx.value) >= 0) {
          endTime = moment(moment(hosts[i].time.buckets[endingIdx].key_as_string).toArray());
          startTime = moment(moment(hosts[i].time.buckets[startingIdx].key_as_string).toArray());
          seconds = endTime.diff(startTime, 'seconds');

          rxValues.push({
            x: hosts[i].time.buckets[endingIdx].key_as_string,
            y: (hosts[i].time.buckets[endingIdx].rx.value - hosts[i].time.buckets[startingIdx].rx.value)/seconds
          });
        }

        startingIdx = endingIdx-2;
        endingIdx += 1;
      }

      retVal.push({ key: key+" rx", values: rxValues});
    }

    endingIdx = 1;
    for (i = 0; i < hosts.length; i += 1) {
        key = hosts[i].key;
        txValues = [];

        endingIdx = 1;
        for (startingIdx = 0;  (startingIdx < hosts[i].time.buckets.length - 1) && (endingIdx < hosts[i].time.buckets.length - truncatedBuckets); startingIdx += 1) {

          // find starting index
          while((startingIdx < hosts[i].time.buckets.length - 1) && (endingIdx < hosts[i].time.buckets.length) &&
                ((typeof hosts[i].time.buckets[startingIdx].tx.value === "undefined") || (hosts[i].time.buckets[startingIdx].tx.value === null) ||
                (typeof hosts[i].time.buckets[startingIdx].key_as_string === "undefined") || (hosts[i].time.buckets[startingIdx].key_as_string === null))) {
                  startingIdx += 1;
                  endingIdx = startingIdx+1;
          }

          // find ending index
          while( (endingIdx < hosts[i].time.buckets.length) &&
                ((typeof hosts[i].time.buckets[endingIdx].tx.value === "undefined") || (hosts[i].time.buckets[endingIdx].tx.value === null) ||
                (typeof hosts[i].time.buckets[endingIdx].key_as_string === "undefined") || (hosts[i].time.buckets[endingIdx].key_as_string === null))) {
              endingIdx += 1;
          }

          // make sure we have a positive value
          while((endingIdx < hosts[i].time.buckets.length) &&
                ((hosts[i].time.buckets[endingIdx].tx.value - hosts[i].time.buckets[startingIdx].tx.value) < 0)) {
              endingIdx += 1;
          }

          if((startingIdx < hosts[i].time.buckets.length - 1) && (endingIdx < hosts[i].time.buckets.length) &&
            (hosts[i].time.buckets[endingIdx].tx.value - hosts[i].time.buckets[startingIdx].tx.value) >= 0) {
            endTime = moment(moment(hosts[i].time.buckets[endingIdx].key_as_string).toArray());
            startTime = moment(moment(hosts[i].time.buckets[startingIdx].key_as_string).toArray());
            seconds = endTime.diff(startTime, 'seconds');

            txValues.push({
              x: hosts[i].time.buckets[endingIdx].key_as_string,
              y: (hosts[i].time.buckets[endingIdx].tx.value - hosts[i].time.buckets[startingIdx].tx.value)/seconds
            });
          }

          startingIdx = endingIdx-2;
          endingIdx += 1;
        }

        retVal.push({ key: key+" tx", values: txValues});
      }

    return retVal;
};

module.exports = {
    transform: transform
};
