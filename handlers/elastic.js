var esClient = require('../helpers/es-client'),
    constructOptions = require('../helpers/es-options');

var es = esClient(config.elastic);

on('ElasticQuery', function (query) {

  var searchOptions = constructOptions(query),
      searchResultsPromise = es.search(searchOptions);

  return searchResultsPromise.then(function (results) {
    return results.hits.hits.map(function (hit) { return hit._source; });
  });
});

