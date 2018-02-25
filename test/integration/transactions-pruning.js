"use strict";

const co        = require('co');
const should    = require('should');
const TestUser  = require('./tools/TestUser').TestUser
const commit    = require('./tools/commit');
const toolbox   = require('./tools/toolbox');
const constants = require('../../app/lib/constants');
const CommonConstants = require('../../app/lib/common-libs/constants').CommonConstants

let s1, cat1, tac1

describe("Transactions pruning", function() {

  before(() => co(function*() {

    s1 = toolbox.server({
      currency: 'currency_one',
      dt: 600,
      pair: {
        pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd',
        sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'
      }
    });

    cat1 = new TestUser('cat', { pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd', sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'}, { server: s1 });
    tac1 = new TestUser('tac', { pub: '2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc', sec: '2HuRLWgKgED1bVio1tdpeXrf7zuUszv1yPHDsDj7kcMC4rVSN9RC58ogjtKNfTbH1eFz7rn38U1PywNs3m6Q7UxE'}, { server: s1 });

    yield s1.prepareForNetwork();

    const now = parseInt(Date.now() / 1000);

    // Publishing identities
    yield cat1.createIdentity();
    yield tac1.createIdentity();
    yield cat1.cert(tac1);
    yield tac1.cert(cat1);
    yield cat1.join();
    yield tac1.join();
    yield s1.commit();
    yield s1.commit({
      time: now + 1300
    });
    yield s1.commit();
    yield cat1.send(20, tac1);
    yield cat1.send(100, tac1);
  }));

  after(() => {
    return Promise.all([
      s1.closeCluster()
    ])
  })

  it('double spending transactions should both exist first', () => s1.expect('/tx/history/HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd', (res) => {
    res.history.should.have.property('sending').length(2);
  }));

  it('should only commit 1 tx', () => co(function*() {
    yield s1.commit();
    yield s1.expect('/blockchain/block/2', (res) => {
      res.should.have.property('transactions').length(0);
    });
    yield s1.expect('/blockchain/block/3', (res) => {
      res.should.have.property('transactions').length(1);
    });
  }));

  it('double spending transaction should have been pruned', () => co(function*() {
    const tmp = CommonConstants.TRANSACTION_MAX_TRIES;
    CommonConstants.TRANSACTION_MAX_TRIES = 1;
    yield s1.commit();
    yield s1.expect('/tx/history/HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd', (res) => {
      res.history.should.have.property('sending').length(0);
    });
    CommonConstants.TRANSACTION_MAX_TRIES = tmp;
  }));
});
