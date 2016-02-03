var expect = require("expect.js"),
    elasticsearch = require('elasticsearch'),
    config = require('../config.json'),
    mapping = require('./es-mapping/overwatch-index-mapping.json');

var MicroService = require('persephone-ms');
var ms = MicroService.forTest();

describe("ElasticQuery", function() {
    var client;
    before(function() {
      var template = {
        name : 'template_overwatch',
        body: {
            "template" : mapping.template,
            "settings" : mapping.settings,
            "mappings" : mapping.mappings
          }
        };

        client = new elasticsearch.Client({
          host: '10.0.2.2:9200',
          log: 'info'
        });

        client.indices.putTemplate(template).then(function(response){
          console.log('successfully created ElasticSearch Template');
        });

    });

    it("query elasticsearch", function(done) {
      client.index({
          index: 'overwatch-2016-01-20',
          type: 'syslog',
          body: {
            "@timestamp": '2016-01-20T21:47:32.854Z',
            message: 'Some random message from KSI Log Event TBD',
            epoch_time: "1447196711.910",
            syslog_message: "Some random message from KSI Log Event TBD",
            message_type: 'KSI_TBD',
          }
        }, function (error, response) {

        });

      client.search({
        index: 'overwatch-*',
        type: 'syslog',
        body: {
          from:0,
          size:30,
          query:{
            filtered:{
              filter:{
                bool:{
                  must:[
                    {
                      range:{
                        "@timestamp":{
                           gte:"2016-01-20T21:47:32.854Z",
                           lte:"2016-01-27T22:17:32.855Z",
                           format:"date_optional_time"
                        }
                      }
                    },
                    {
                      term:{
                        message_type:"KSI_TBD"
                     }
                    }
                  ]
                }
              }
            }
          },
          sort:[
            {
              "@timestamp":{
                order:"desc",
                ignore_unmapped:true
              }
            }
          ]
        }
      }).then(function (resp) {
        var hits = resp.hits.hits;
        console.log("HITS ==> " + JSON.stringify(hits, null, 2));
        //expect(hits.length).to.be(1);
        done();
      }, function (err) {
        console.trace(err.message);
      });
    });
});
