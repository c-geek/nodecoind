"use strict";
var Q = require('q');
var async  = require('async');
var request  = require('request');
var vucoin = require('vucoin');
var ucoin  = require('../../../index');
var Configuration = require('../../../app/lib/entity/configuration');
var Peer          = require('../../../app/lib/entity/peer');

module.exports = function (options) {
	return new Node(options);
};

function Node (options) {

  var that = this;
  var started = false;
  that.server = null;
  that.http = null;

  /**
   * To be executed before tests
   * @param scenarios Scenarios to execute: a suite of operations over a node (identities, certs, tx, blocks, ...).
   * @returns {Function} Callback executed by unit test framework.
   */
  this.before = function (scenarios) {
    return function(done) {
      async.waterfall([
        function(next) {
          that.server.reset(next);
        },
        function (next) {
          vucoin(options.remoteipv4, options.remoteport, next);
        },
        function (node, next) {
          that.http = node;
          that.executes(scenarios, next);
        }
      ], done);
    }
  };

  this.executes = function (scenarios, done) {
    async.waterfall([
      function(next) {
        async.forEachSeries(scenarios, function(useCase, callback) {
          useCase(callback);
        }, next);
      }
    ], done);
  };

  /**
   * To be exectued after unit tests. Here: clean the database (removal)
   * @returns {Function} Callback executed by unit test framework.
   */
  this.after = function () {
    return function (done) {
      async.waterfall([
        function(next) {
          //that.server.conn.db.dropDatabase(next);
          next();
        }
      ], done);
    }
  };

  /**
   * Generates next block and submit it to local node.
   * @returns {Function}
   */
  this.commit = function() {
    return function(done) {
      async.waterfall([
        function(next) {
          async.parallel({
            block: function(callback){
              that.server.BlockchainService.generateNext(callback);
            },
            sigFunc: function(callback){
              require('../../../app/lib/signature').sync(that.server.pair, callback);
            }
          }, next);
        },
        function(res, next) {
          var block = res.block;
          var sigFunc = res.sigFunc;
          var pub = that.server.PeeringService.pubkey;
          proveAndSend(that.server, block, sigFunc, pub, block.powMin, next);
        }
      ], function(err) {
        done(err);
      });
    }
  };

  function proveAndSend (server, block, sigFunc, issuer, difficulty, done) {
    var BlockchainService = server.BlockchainService;
    async.waterfall([
      function (next){
        block.issuer = issuer;
        BlockchainService.prove(block, sigFunc, difficulty, next);
      },
      function (block, next){
        post('/blockchain/block', {
          "block": block.getRawSigned()
        }, next);
      }
    ], done);
  }

  function post(uri, data, done) {
    var postReq = request.post({
      "uri": 'http://' + [that.server.conf.remoteipv4, that.server.conf.remoteport].join(':') + uri,
      "timeout": 1000*10
    }, function (err, res, body) {
      done(err, res, body);
    });
    postReq.form(data);
  }
  
  this.start = function(done) {
    return Q.Promise(function(resolve, reject){
      if (started) return done();
      async.waterfall([
        function(next) {
          service(ucoin.createTxServer, next)();
        },
        function (server, next){
          // Launching server
          that.server = server;
          that.server.start(function (err) {
            started = true;
            next(err);
          });
        },
        function (next) {
          vucoin(options.remoteipv4, options.remoteport, next);
        },
        function (node, next) {
          that.http = node;
          next();
        }
        //function (next) {
        //  var theRouter = router(server.PeeringService.pubkey, server.conn, server.conf, server.dal);
        //  var theCaster = multicaster();
        //  server
        //    .pipe(theRouter) // The router ask for multicasting of documents
        //    .pipe(theCaster) // The multicaster may answer 'unreachable peer'
        //    .pipe(theRouter);
        //}
      ], function(err) {
        err ? reject(err) : resolve();
        done && done(err);
      });
    });
  };

  function service(serverFactory, callback) {
    if (arguments.length == 1) {
      callback = serverFactory;
      serverFactory = ucoin.createTxServer;
    }
    return function () {
      var cbArgs = arguments;
      var server = serverFactory({ memory: true }, Configuration.statics.complete(options));

        //cbArgs.length--;
        cbArgs[cbArgs.length++] = server;
        //cbArgs[cbArgs.length++] = server.conf;
        callback(null, server);
      });
    };
  }

  /************************
   *    TEST UTILITIES
   ************************/

  this.lookup = function(search, callback) {
    return function(done) {
      async.waterfall([
        function(next) {
          that.http.wot.lookup(search, next);
        }
      ], function(err, res) {
        callback(res, done);
      });
    }
  };

  this.until = function (eventName, count) {
    var counted = 0;
    var max = count == undefined ? 1 : count;
    return Q.Promise(function (resolve) {
      that.server.on(eventName, function (obj) {
        counted++;
        if (counted == max)
          resolve();
      });
    });
  };

  this.current = function(callback) {
    return function(done) {
      async.waterfall([
        function(next) {
          that.http.blockchain.current(next);
        }
      ], function(err, current) {
        callback(current, done);
      });
    }
  };

  this.block = function(number, callback) {
    return function(done) {
      async.waterfall([
        function(next) {
          that.http.blockchain.block(number, next);
        }
      ], function(err, block) {
        callback(block, done);
      });
    }
  };

  this.summary = function(callback) {
    return function(done) {
      async.waterfall([
        function(next) {
          that.http.node.summary(next);
        }
      ], function(err, summary) {
        callback(summary, done);
      });
    }
  };

  this.sourcesOf = function(pub, callback) {
    return function(done) {
      async.waterfall([
        function(next) {
          that.http.tx.sources(pub, next);
        }
      ], function(err, res) {
        callback(res, done);
      });
    }
  };

  this.peering = function(done) {
    that.http.network.peering.get(done);
  };

  this.submitPeer = function(peer, done) {
    post('/network/peering/peers', {
      "peer": Peer.statics.peerize(peer).getRawSigned()
    }, done);
  };
}
