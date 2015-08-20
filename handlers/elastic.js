var esClient = require('../helpers/es-client'),
    constructOptions = require('../helpers/es-options'),
    aggs = require('../helpers/es-aggregation');

var es = esClient(config.elastic);

on('ElasticQuery', function (query) {
  var searchOptions = constructOptions(query);
  return es.search(searchOptions).then(function (results) {
    return results.hits.hits.map(function (hit) { return hit._source; });
  });
});

on('ElasticAggregation', function (params) {
  var query = params.query, aggregation = aggs[query](params);
  return es.search(aggregation.options).then(aggregation.transform);
});
