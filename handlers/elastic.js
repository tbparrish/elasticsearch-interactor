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
  query('SystemPropertiesGet', {props: "deployment"}).then(function(response){
    var deploymentSettings = JSON.parse(response.deployment);

    var hostname = deploymentSettings.elasticsearch.hostname;
    var port = deploymentSettings.elasticsearch.port;

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

  function checkAppliances(appliances) {
    var isVideri = false,
        isBlackLantern = false,
        appliance;

    if(Array.isArray(appliances)) {
      for(var i = 0; i < appliances.length; i++) {
        appliance = JSON.parse(appliances[i]);
        if(appliance.type === 'videri') {
          isVideri = true;
        } else if(appliance.type === 'blackLantern') {
          isBlackLantern = true;
        }
      }
    } else {
      appliance = JSON.parse(appliances);
      if(appliance.type === 'videri') {
        isVideri = true;
      } else if(appliance.type === 'blackLantern') {
        isBlackLantern = true;
      }
    }

    return { videri: isVideri,  blackLantern: isBlackLantern};
  }

  var query = params.query, videriAggregation, videriPromise, videriTransform,
                            blackLanternAggregation, blackLanternPromise, blackLanternTransform;

  if(query !== 'cpu') {
    var aggregation = aggs[query](params);
    return es.search(aggregation.options).then(aggregation.transform);
  } else {
    if(params.appliances === undefined) {
      videriAggregation = aggs.videriCPU(params);
      videriPromise = es.search(videriAggregation.options);

      blackLanternAggregation = aggs.blackLanternCPU(params);
      blackLanternPromise = es.search(blackLanternAggregation.options);

      return Promise.all([videriPromise, blackLanternPromise]).then(function(promises){
        videriTransform = videriAggregation.transform(promises[0]);
        blackLanternTransform = blackLanternAggregation.transform(promises[1]);
        //TODO: there may be a better to concat an array of objects....
        _(blackLanternTransform).each(function(result){
          videriTransform.push(result);
        });
        return videriTransform;
      });
    } else {
      var applianceType = checkAppliances(params.appliances);
      if((applianceType.videri === true) && (applianceType.blackLantern === true)){
        videriAggregation = aggs.videriCPU(params);
        videriPromise = es.search(videriAggregation.options);

        blackLanternAggregation = aggs.blackLanternCPU(params);
        blackLanternPromise = es.search(blackLanternAggregation.options);

        return Promise.all([videriPromise, blackLanternPromise]).then(function(promises){
          videriTransform = videriAggregation.transform(promises[0]);
          blackLanternTransform = blackLanternAggregation.transform(promises[1]);
          //TODO: there may be a better to concat an array of objects....
          _(blackLanternTransform).each(function(result){
            videriTransform.push(result);
          });
          return videriTransform;
        });
      } else if((applianceType.videri === true) && (applianceType.blackLantern === false)){
        videriAggregation = aggs.videriCPU(params);
        return es.search(videriAggregation.options).then(videriAggregation.transform);
      } else if((applianceType.videri === false) && (applianceType.blackLantern === true)){
        blackLanternAggregation = aggs.blackLanternCPU(params);
        return es.search(blackLanternAggregation.options).then(blackLanternAggregation.transform);
      }
    }
  }
});

on('ElasticAddCommand', function(record){
  return es.create(record);
});
