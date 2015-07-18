var esClient = require('../helpers/es-client'),
    constructOptions = require('../helpers/es-options');

var es = esClient(config.elastic);

on('ElasticQuery', function (query) {
  var searchOptions = constructOptions(query);
  return es.search(searchOptions).then(function (results) {
    return results.hits.hits.map(function (hit) { return hit._source; });
  });
});

