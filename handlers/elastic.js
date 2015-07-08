var esClient = require('../helpers/es-client'),
    constructOptions = require('../helpers/es-options');

var es = esClient(config.elastic);

on('ElasticOptions', function (query) {
  return constructOptions(query);
});

on('ElasticQuery', function (searchOptions) {
  return es.search(searchOptions).then(function (results) {
    return results.hits.hits.map(function (hit) { return hit._source; });
  });
});

