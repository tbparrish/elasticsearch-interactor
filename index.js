var MicroService = require('persephone-ms');
var ms = new MicroService();

ms.query('ElasticAggregation', { from : '2015-07-27Z', to: '2015-08-02Z', query: 'responseTime' }).then(function (results) {
  ms.log.info("Reply received from Elastic", results);
});