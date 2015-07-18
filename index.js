var MicroService = require('persephone-ms');
var ms = new MicroService();

ms.query('ElasticQuery', { from : '2015-05-14Z', to: '2015-05-15Z' }).then(function (results) {
  ms.log.info("Reply received from Elastic", results);
});