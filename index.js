var MicroService = require('persephone-ms');
var ms = new MicroService();

ms.query('ElasticQuery', { from : '2014-05-14Z', to: '2015-05-15Z' }).then(function (reply) {
  ms.log.info("Reply received from Elastic", reply);
});