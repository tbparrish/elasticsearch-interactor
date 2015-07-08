var elasticsearch = require('elasticsearch');

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

module.exports = function(esHost) {
  return new elasticsearch.Client({
    host: esHost,
    log: WinstonLogger
  });
};