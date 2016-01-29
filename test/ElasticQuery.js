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
        name : mapping.template,
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

        // delete indices
        client.indices.delete({index: '*'}, function(e,r) {
          if(e) {
            console.log('failed to delete ElasticSearch Indices, ' + e.message);
          } else {
            console.log('successfully delete ElasticSearch Indices');
          }

          // create indices and mappings
          client.indices.putTemplate(template, function(err, resp) {
            if(err) {
              console.log('failed to create ElasticSearch Template, ' + err.message);
            } else {
              console.log('successfully created ElasticSearch Template');
            }
          });
        });
    });

    it("query elasticsearch", function(done) {
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
        //console.log("HITS ==> " + JSON.stringify(hits, null, 2));
        done();
      }, function (err) {
        console.trace(err.message);
      });
    });
});
