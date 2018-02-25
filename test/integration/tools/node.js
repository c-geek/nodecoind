"use strict";
var co = require('co');
var _ = require('underscore');
var async  = require('async');
var request  = require('request');
var contacter = require('../../../app/modules/crawler').CrawlerDependency.duniter.methods.contacter;
var duniter  = require('../../../index');
var multicaster = require('../../../app/lib/streams/multicaster');
var ConfDTO = require('../../../app/lib/dto/ConfDTO').ConfDTO
var PeerDTO   = require('../../../app/lib/dto/PeerDTO').PeerDTO
var http   = require('./http');
const bma = require('../../../app/modules/bma').BmaDependency.duniter.methods.bma;

module.exports = function (dbName, options) {
  return new Node(dbName, options);
};

module.exports.statics = {
};

var UNTIL_TIMEOUT = 20000;

function Node (dbName, options) {

  var logger = require('../../../app/lib/logger').NewLogger(dbName);
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
        function (next) {
          that.http = contacter(options.remoteipv4, options.remoteport);
          that.executes(scenarios, next);
        }
      ], done);
    };
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
      done();
    };
  };

  /**
   * Generates next block and submit it to local node.
   * @returns {Function}
   */
  this.commit = function(params) {
    return function(done) {
      async.waterfall([
        function(next) {
          async.parallel({
            block: function(callback){
              co(function *() {
                try {
                  const block2 = yield require('../../../app/modules/prover').ProverDependency.duniter.methods.generateTheNextBlock(that.server, params);
                  const trial2 = yield that.server.getBcContext().getIssuerPersonalizedDifficulty(that.server.keyPair.publicKey);
                  const block = yield require('../../../app/modules/prover').ProverDependency.duniter.methods.generateAndProveTheNext(that.server, block2, trial2, params);
                  callback(null, block);
                } catch (e) {
                  callback(e);
                }
              });
            }
          }, next);
        },
        function(res, next) {
          var block = res.block;
          logger.debug(block.getRawSigned());
          post('/blockchain/block', {
            "block": block.getRawSigned()
          }, next);
        }
      ], function(err, res) {
        done(err, res.body);
      });
    };
  };

  function post(uri, data, done) {
    return new Promise((resolve, reject) => {
      var postReq = request.post({
        "uri": 'http://' + [that.server.conf.remoteipv4, that.server.conf.remoteport].join(':') + uri,
        "timeout": 1000 * 10,
        "json": true
      }, function (err, res, body) {
        if (err) {
          reject(err)
          done && done(err)
        } else {
          resolve(res, body)
          done && done(err, res, body)
        }
      });
      postReq.form(data);
    })
  }

  this.startTesting = function(done) {
    return new Promise(function(resolve, reject){
      if (started) return done();
      async.waterfall([
        function(next) {
          service(next)();
        },
        function (server, next){
          // Launching server
          that.server = server;
          started = true;
          server.PeeringService.generateSelfPeer(server.conf, 0)
            .then(() => next())
            .catch(next)
        },
        function (next) {
          that.http = contacter(options.remoteipv4, options.remoteport);
          next();
        }
      ], function(err) {
        err ? reject(err) : resolve();
        done && done(err);
      });
    });
  };

  function service(callback) {
    return function () {
      const stack = duniter.statics.simpleStack();
      stack.registerDependency({
        duniter: {
          config: {
            onLoading: (conf, program) => co(function*() {
              const overConf = ConfDTO.complete(options);
              _.extend(conf, overConf);
            })
          },
          service: {
            process: (server) => _.extend(server, {
              startService: () => {
                logger.debug('Server Servie Started!');
              }
            })
          },
          cli: [{
            name: 'execute',
            desc: 'Unit Test execution',
            onDatabaseExecute: (server, conf, program, params, startServices) => co(function*() {
              yield startServices();
              callback(null, server);
              yield Promise.resolve((res) => null); // Never ending
            })
          }]
        }
      }, 'duniter-automated-test');
      options.port = options.port || 10901;
      options.ipv4 = options.ipv4 || "127.0.0.1";
      options.ipv6 = options.ipv6 || null;
      options.remotehost = options.remotehost || null;
      options.remoteipv4 = options.remoteipv4 || null;
      options.remoteipv6 = options.remoteipv6 || null;
      options.remoteport = options.remoteport || 10901;
      const cliOptions = ['--ws2p-noupnp']
      if (options.port) {
        cliOptions.push('--port')
        cliOptions.push(options.port)
      }
      if (options.ipv4) {
        cliOptions.push('--ipv4')
        cliOptions.push(options.ipv4)
      }
      if (options.ipv6) {
        cliOptions.push('--ipv6')
        cliOptions.push(options.ipv6)
      }
      if (options.remotehost) {
        cliOptions.push('--remoteh')
        cliOptions.push(options.remotehost)
      }
      if (options.remoteipv4) {
        cliOptions.push('--remote4')
        cliOptions.push(options.remoteipv4)
      }
      if (options.remoteipv6) {
        cliOptions.push('--remote6')
        cliOptions.push(options.remoteipv6)
      }
      if (options.remoteport) {
        cliOptions.push('--remotep')
        cliOptions.push(options.remoteport)
      }

      stack.registerDependency(require('../../../app/modules/keypair').KeypairDependency, 'duniter-keypair')
      stack.registerDependency(require('../../../app/modules/bma').BmaDependency,         'duniter-bma')
      stack.executeStack(['', '', '--mdb', dbName, '--memory', 'execute'].concat(cliOptions));
    };
  }

  /************************
   *    TEST UTILITIES
   ************************/

  this.lookup = function(search, callback) {
    return function(done) {
      co(function*(){
        try {
          const res = yield that.http.getLookup(search);
          callback(res, done);
        } catch (err) {
          logger.error(err);
          callback(null, done);
        }
      });
    };
  };

  this.until = function (eventName, count) {
    var counted = 0;
    var max = count == undefined ? 1 : count;
    return new Promise(function (resolve, reject) {
      var finished = false;
      that.server.on(eventName, function () {
        counted++;
        if (counted == max) {
          if (!finished) {
            finished = true;
            resolve();
          }
        }
      });
      setTimeout(function() {
        if (!finished) {
          finished = true;
          reject('Received ' + counted + '/' + count + ' ' + eventName + ' after ' + UNTIL_TIMEOUT + ' ms');
        }
      }, UNTIL_TIMEOUT);
    });
  };

  this.block = function(number, callback) {
    return function(done) {
      co(function*(){
        try {
          const res = yield that.http.getBlock(number);
          callback(res, done);
        } catch (err) {
          logger.error(err);
          callback(null, done);
        }
      });
    };
  };

  this.summary = function(callback) {
    return function(done) {
      co(function*(){
        try {
          const res = yield that.http.getSummary();
          callback(res, done);
        } catch (err) {
          logger.error(err);
          callback(null, done);
        }
      });
    };
  };

  this.peering = function(done) {
    co(function*(){
      try {
        const res = yield that.http.getPeer();
        done(null, res);
      } catch (err) {
        logger.error(err);
        done(err);
      }
    });
  };

  this.peeringP = () => that.http.getPeer();

  this.submitPeer = function(peer, done) {
    return post('/network/peering/peers', {
      "peer": PeerDTO.fromJSONObject(peer).getRawSigned()
    }, done);
  };

  this.submitPeerP = (peer) => new Promise((res, rej) => {
    that.submitPeer(peer, (err, data) => {
      if (err) return rej(err)
      res(data)
    })
  })

  this.commitP = (params) => new Promise((res, rej) => {
    this.commit(params)((err, data) => {
      if (err) return rej(err)
      res(data)
    })
  })
}
