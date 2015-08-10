var MicroService = require('persephone-ms');
var ms = new MicroService();

ms.query('ElasticAggregation', { from : '2015-08-03Z', to: '2015-08-10Z', query: 'cpu' }).then(function (results) {
  ms.log.info("Reply received from Elastic", results);
});