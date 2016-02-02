var elasticsearch = require('elasticsearch'),
    constructOptions = require('../helpers/es-options'),
    aggs = require('../helpers/es-aggregation');

var es;

function WinstonLogger() {
  this.error = log.error.bind(log);
  this.warning = log.warn.bind(log);
  this.info = log.info.bind(log);
  this.debug = log.debug.bind(log);
  this.trace = function (method, requestUrl, body, responseBody, responseStatus) {
    log.log('trace', {
      method: method,
      requestUrl: requestUrl,
      body: body,
      responseBody: responseBody,
      responseStatus: responseStatus
    });
  };
  this.close = function () { /* Winston loggers do not need to be closed */ };
}

var elasticConnectFromSettings = function(){
  query('SystemPropertiesGet', {props: "settings"}).then(function(settings){
    // TODO: This is silly, why arent we returning the actual object here.
    settings = JSON.parse(settings.settings);

    var hostname = settings.deployment.elasticsearch.hostname;
    var port = settings.deployment.elasticsearch.port;

    if (!hostname || !port) throw new Error('missing host/port for elasticsearch in settings');

    es =  esClient(hostname + ":" + port);
  }).catch(function(err){
    console.log(err);
    console.log("Invalid elasticsearch settings, using default");
    es =  esClient(config.elastic);
  });
};

var esClient = function(esHost) {
  return new elasticsearch.Client({
    host: esHost,
    log: WinstonLogger
  });
};

on('SystemPropertyUpdatedEvent', elasticConnectFromSettings);
on('SystemPropertyCreatedEvent', elasticConnectFromSettings);
elasticConnectFromSettings();

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

on('ElasticAddCommand', function(record){
  return es.create(record);
});
