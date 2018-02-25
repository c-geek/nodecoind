"use strict";

const co        = require('co');
const should    = require('should');
const bma       = require('../../app/modules/bma').BmaDependency.duniter.methods.bma;
const TestUser  = require('./tools/TestUser').TestUser
const commit    = require('./tools/commit');
const toolbox   = require('./tools/toolbox');

let s1, cat1, cat2, catb

describe("Identities with shared pubkey", function() {

  before(() => co(function*() {

    s1 = toolbox.server({
      pair: {
        pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd',
        sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'
      }
    });

    cat1 = new TestUser('cat1', { pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd', sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'}, { server: s1 });
    cat2 = new TestUser('cat2', { pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd', sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'}, { server: s1 });
    catb = new TestUser('cat1', { pub: '2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc', sec: '2HuRLWgKgED1bVio1tdpeXrf7zuUszv1yPHDsDj7kcMC4rVSN9RC58ogjtKNfTbH1eFz7rn38U1PywNs3m6Q7UxE'}, { server: s1 });

    yield s1.initDalBmaConnections();

    yield cat2.createIdentity();

    // Early certification, to have only one matching 'HgTT' key at this moment
    yield catb.cert(cat2);

    // catb gets certified by 'HgTT'
    yield cat1.createIdentity();
    yield catb.createIdentity();
    yield cat1.cert(catb);
  }));

  after(() => {
    return Promise.all([
      s1.closeCluster()
    ])
  })

  it('should exit 2 pubkey result', () => s1.expect('/wot/lookup/cat', (res) => {
    res.results.should.have.length(2);
    res.results[0].should.have.property('pubkey').equal('HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd');
    res.results[1].should.have.property('pubkey').equal('2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc');
  }));

  it('pubkey HgTT should have signed 1 key', () => s1.expect('/wot/lookup/cat', (res) => {
    res.results.should.have.length(2);
    res.results[0].should.have.property('signed').length(1);
    const pubkey_hgtt = res.results[0];
    const pubkey_2lvd = res.results[1];
    const cat2idty = pubkey_hgtt.uids[0];
    const cat1idty = pubkey_hgtt.uids[1];
    const catbidty = pubkey_2lvd.uids[0];

    cat1idty.should.have.property('uid').equal('cat1');
    cat1idty.should.have.property('others').length(0); // Has not been certified

    cat2idty.should.have.property('uid').equal('cat2');
    cat2idty.should.have.property('others').length(1);
    // Certified by 2LvD
    cat2idty.others[0].should.have.property('pubkey').equal('2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc');

    catbidty.should.have.property('others').length(1);
    pubkey_2lvd.should.have.property('signed').length(1);
    // Certified by 2LvD
    catbidty.others[0].should.have.property('pubkey').equal('HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd');
  }));
});
