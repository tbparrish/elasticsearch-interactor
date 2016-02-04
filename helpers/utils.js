function hasHostsBuckets(results) {
  return typeof results !== "undefined" &&
    results !== null &&
    typeof results.aggregations !== "undefined" &&
    results.aggregations !== null &&
    typeof results.aggregations.hosts !== "undefined" &&
    results.aggregations.hosts !== null &&
    typeof results.aggregations.hosts.buckets !== "undefined" &&
    results.aggregations.hosts.buckets !== null;
}

function hasLinesBuckets(results) {
  return typeof results !== "undefined" &&
    results !== null &&
    typeof results.aggregations !== "undefined" &&
    results.aggregations !== null &&
    typeof results.aggregations.lines !== "undefined" &&
    results.aggregations.lines !== null &&
    typeof results.aggregations.lines.buckets !== "undefined" &&
    results.aggregations.lines.buckets !== null;
}

function hasTimeBuckets(results) {
  return typeof results !== "undefined" &&
    results !== null &&
    typeof results.aggregations !== "undefined" &&
    results.aggregations !== null &&
    typeof results.aggregations.time !== "undefined" &&
    results.aggregations.time !== null;
}

function hasXBuckets(results) {
  return typeof results !== "undefined" &&
    results !== null &&
    typeof results.aggregations !== "undefined" &&
    results.aggregations !== null &&
    typeof results.aggregations.x !== "undefined" &&
    results.aggregations.x !== null &&
    typeof results.aggregations.x.buckets !== "undefined" &&
    results.aggregations.x.buckets !== null;
}

function hasSlicesBuckets(results) {
  return typeof results !== "undefined" &&
    results !== null &&
    typeof results.aggregations !== "undefined" &&
    results.aggregations !== null &&
    typeof results.aggregations.slices !== "undefined" &&
    results.aggregations.slices !== null &&
    typeof results.aggregations.slices.buckets !== "undefined" &&
    results.aggregations.slices.buckets !== null;
}

module.exports = {
  hasHostsBuckets: hasHostsBuckets,
  hasLinesBuckets: hasLinesBuckets,
  hasTimeBuckets: hasTimeBuckets,
  hasXBuckets: hasXBuckets,
  hasSlicesBuckets: hasSlicesBuckets
};
