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
  var query = params.query, videriAggregation, videriPromise, videriTransform,
                            blackLanternAggregation, blackLanternPromise, blackLanternTransform;

  if(query !== 'cpu') {
    var aggregation = aggs[query](params);
    return es.search(aggregation.options).then(aggregation.transform);
  } else if((query === 'cpu') && (params.appliances)) {
      var videriAppliances = [];
      var blackLanternAppliances = [];

      if(Array.isArray(params.appliances)) {
        for(var i = 0; i < params.appliances.length; i++) {
          var appliance = JSON.parse(params.appliances[i]);
          if(appliance.type === 'videri'){
            videriAppliances.push(appliance.ip);
          } else {
            blackLanternAppliances.push(appliance.ip);
          }
        }
      } else {
        params.appliances = JSON.parse(params.appliances);

        if(params.appliances.type === 'videri') {
          videriAppliances.push(params.appliances.ip);
        } else {
          blackLanternAppliances.push(params.appliances.ip);
        }
      }

      delete params.appliances;

      if(videriAppliances.length > 0) {
        params.appliance_ips = videriAppliances;
        videriAggregation = aggs.videriCPU(params);
        videriPromise = es.search(videriAggregation.options);
      }

      if(blackLanternAppliances.length > 0) {
        params.appliance_ips = blackLanternAppliances;
        blackLanternAggregation = aggs.blackLanternCPU(params);
        blackLanternPromise = es.search(blackLanternAggregation.options);
      }

      if((videriAppliances.length > 0) && (blackLanternAppliances.length > 0)) {
        return Promise.all([videriPromise, blackLanternPromise]).then(function(promises){
          videriTransform = videriAggregation.transform(promises[0]);
          blackLanternTransform = blackLanternAggregation.transform(promises[1]);
          //TODO: there may be a better to concat an array of objects....
          _(blackLanternTransform).each(function(result){
            videriTransform.push(result);
          });
          return videriTransform;
        });
      } else if((videriAppliances.length > 0)) {
        return videriPromise.then(videriAggregation.transform);
      } else {
        return blackLanternPromise.then(blackLanternAggregation.transform);
      }
    } else if((query === 'cpu') && (params.appliances === undefined)) {
      videriAggregation = aggs.videriCPU(params);
      blackLanternAggregation = aggs.blackLanternCPU(params);
      videriPromise = es.search(videriAggregation.options);
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
    }
});

on('ElasticAddCommand', function(record){
  return es.create(record);
});
