var MicroService = require('persephone-ms');
var ms = new MicroService();

ms.query('ElasticOptions', { from : '2015-05-14Z', to: '2015-05-15Z' }).then(function (searchOptions) {
  return ms.query('ElasticQuery', searchOptions);
}).then(function (results) {
  ms.log.info("Reply received from Elastic", results);
});