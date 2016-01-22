module.exports = {};

module.exports.hasHostsBuckets = function(results) {
  return typeof results !== "undefined" &&
    results !== null &&
    typeof results.aggregations !== "undefined" &&
    results.aggregations !== null &&
    typeof results.aggregations.hosts !== "undefined" &&
    results.aggregations.hosts !== null &&
    typeof results.aggregations.hosts.buckets !== "undefined" &&
    results.aggregations.hosts.buckets !== null;
};
