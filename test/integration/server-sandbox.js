"use strict";

const co        = require('co');
const should    = require('should');
const bma       = require('../../app/modules/bma').BmaDependency.duniter.methods.bma;
const TestUser  = require('./tools/TestUser').TestUser
const commit    = require('./tools/commit');
const toolbox   = require('./tools/toolbox');
const constants = require('../../app/lib/constants');
const CommonConstants = require('../../app/lib/common-libs/constants').CommonConstants

const now = 1482300000;

let s1, s2, s3, i1, i2, i3, i4, i5, i6, i7, i7onS2, i8, i9, i10, i11, i12, i13, i14, i15, i16

describe("Sandboxes", function() {

  before(() => co(function*() {

    s1 = toolbox.server({
      idtyWindow: 10,
      sigWindow: 10,
      msWindow: 10,
      dt: 10,
      udTime0: now + 1,
      pair: {
        pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd',
        sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'
      }
    });

    s2 = toolbox.server({
      pair: {
        pub: 'DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV',
        sec: '468Q1XtTq7h84NorZdWBZFJrGkB18CbmbHr9tkp9snt5GiERP7ySs3wM8myLccbAAGejgMRC9rqnXuW3iAfZACm7'
      }
    });

    s3 = toolbox.server({
      pair: {
        pub: 'H9dtBFmJohAwMNXSbfoL6xfRtmrqMw8WZnjXMHr4vEHX',
        sec: '2ANWb1qjjYRtT2TPFv1rBWA4EVfY7pqE4WqFUuzEgWG4vzcuvyUxMtyeBSf93M4V3g4MeEkELaj6NjA72jxnb4yF'
      }
    });

    i1 = new TestUser('i1',   { pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd', sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'}, { server: s1 });
    i2 = new TestUser('i2',   { pub: 'DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV', sec: '468Q1XtTq7h84NorZdWBZFJrGkB18CbmbHr9tkp9snt5GiERP7ySs3wM8myLccbAAGejgMRC9rqnXuW3iAfZACm7'}, { server: s1 });
    i3 = new TestUser('i3',   { pub: 'DKpQPUL4ckzXYdnDRvCRKAm1gNvSdmAXnTrJZ7LvM5Qo', sec: '64EYRvdPpTfLGGmaX5nijLXRqWXaVz8r1Z1GtaahXwVSJGQRn7tqkxLb288zwSYzELMEG5ZhXSBYSxsTsz1m9y8F'}, { server: s1 });
    i4 = new TestUser('i4',   { pub: '2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc', sec: '2HuRLWgKgED1bVio1tdpeXrf7zuUszv1yPHDsDj7kcMC4rVSN9RC58ogjtKNfTbH1eFz7rn38U1PywNs3m6Q7UxE'}, { server: s1 });
    i5 = new TestUser('i5',   { pub: '91dWdiyf7KaC4GAiKrwU7nGuue1vvmHqjCXbPziJFYtE', sec: '4Zno2b8ZULwBLY3RU5JcZhUf2a5FfXLVUMaYwPEzzN6i4ow9vXPsiCq7u2pEhkgJywqWdj97Hje1fdqnnzHeFgQe'}, { server: s1 });
    i6 = new TestUser('i6',   { pub: '3C95HniUZsUN55AJy7z4wkz1UwtebbNd63dVAZ6EaUNm', sec: '3iJMz8JKNeU692L7jvug8xVnKvzN9RDee2m6QkMKbWKrvoHhv6apS4LR9hP786PUyFYJWz8bReMrFK8PY3aGxB8m'}, { server: s1 });
    i7 = new TestUser('i7',   { pub: '4e9QJhJqHfMzEHgt3GtbfCXjqHVaQuJZKrKt8CNKR3AF', sec: 'TqdT99RpPEUjiz8su5QY7AQwharxPeo4ELCmeaFcvBEd3fW7wY7s9i531LMnTrCYBsgkrES494V6KjkhGppyEcF' }, { server: s1 });
    i7onS2 = new TestUser('i7',   { pub: '4e9QJhJqHfMzEHgt3GtbfCXjqHVaQuJZKrKt8CNKR3AF', sec: 'TqdT99RpPEUjiz8su5QY7AQwharxPeo4ELCmeaFcvBEd3fW7wY7s9i531LMnTrCYBsgkrES494V6KjkhGppyEcF' }, { server: s2 });
    i8 = new TestUser('i8',   { pub: '6GiiWjJxr29Stc4Ph4J4EipZJCzaQW1j6QXKANTNzRV3', sec: 'Yju625FGz6FHErshRc7jZyJUJ83MG4Zh9TXUNML62rKLXz7VJmwofnhJzeRRensranFJGQMYBLNSAeycAAsp62m' }, { server: s1 });
    i9 = new TestUser('i9',   { pub: '6v4HnmiGxNzKwEjnBqxicWAmdKo6Bk51GvfQByS5YmiB', sec: '2wXPPDYfM3a8jmpYiFihS9qzdqFZrLWryu4uwpNPRuw5TRW3JCdJPsMa64eAcpshLTnMXkrKL94argk3FGxzzBKh' }, { server: s1 });
    i10 = new TestUser('i10', { pub: '6kr9Xr86qmrrwGq3XEjUXRVpHqS63FL52tcutcYGcRiv', sec: '2jCzQx7XUWoxboH67mMMv2z8VcrQabtYWpxS39iF6hNQnSBwN1d9RVauVC52PTRz6mgMzTjrSMETPrrB5N3oC7qQ' }, { server: s1 });
    i11 = new TestUser('i11', { pub: '5VLVTp96iX3YAq7NXwZeM2N6RjCkmxaU4G6bwMg1ZNwf', sec: '3BJtyeH1Q8jPcKuzL35m4eVPGuFXpcfRiGSseVawToCWykz1qAic9V2wk31wzEqXjqCq7ZKW4MjtZrzKCGN5K7sT' }, { server: s1 });
    i12 = new TestUser('i12', { pub: 'D6zJSPxZqs1bpgGpzJu9MgkCH7UxkG7D5u4xnnSH62wz', sec: '375vhCZdmVx7MaYD4bMZCevRLtebSuNPucfGevyPiPtdqpRzYLLNfd1h25Q59h4bm54dakpZ1RJ45ZofAyBmX4Et' }, { server: s1 });
    i13 = new TestUser('i13', { pub: 'BQ1fhCsJGohYKKfCbt58zQ8RpiSy5M8vwzdXzm4rH7mZ', sec: '4bTX2rMeAv8x79xQdFWPgY8zQLbPZ4HE7MWKXoXHyCoYgeCFpiWLdfvXwTbt31UMGrkNp2CViEt68WkjAZAQkjjm' }, { server: s1 });
    i14 = new TestUser('i14', { pub: 'H9dtBFmJohAwMNXSbfoL6xfRtmrqMw8WZnjXMHr4vEHX', sec: '2ANWb1qjjYRtT2TPFv1rBWA4EVfY7pqE4WqFUuzEgWG4vzcuvyUxMtyeBSf93M4V3g4MeEkELaj6NjA72jxnb4yF' }, { server: s1 });
// i15 = new TestUser('i15', { pub: '8cHWEmVrdT249w8vJdiBms9mbu6CguQgXx2gRVE8gfnT', sec: '5Fy9GXiLMyhvRLCpoFf35XXNj24WXX29wM6xeCQiy5Uk7ggNhRcZjjp8GcpjRyE94oNR2jRNK4eAGiYUFnvbEnGB' }, { server: s1 });
// i16 = new TestUser('i16', { pub: 'vi8hUTxss825cFCQE4SzmqBaAwLS236NmtrTQZBAAhG',  sec: '5dVvAdWKcndQSaR9pzjEriRhGkCjef74HzecqKnydBVHdxXDewpAu3mcSU72PRKcCkTYTJPpgWmwuCyZubDKmoy4' }, { server: s1 });

    yield s1.initDalBmaConnections();
    yield s2.initDalBmaConnections();
    yield s3.initDalBmaConnections();
    s1.dal.idtyDAL.setSandboxSize(3);
    s1.dal.msDAL.setSandboxSize(2);
    s1.dal.txsDAL.setSandboxSize(2);
    s2.dal.idtyDAL.setSandboxSize(10);
    s3.dal.idtyDAL.setSandboxSize(3);
  }));

  after(() => {
    return Promise.all([
      s1.closeCluster(),
      s2.closeCluster(),
      s3.closeCluster()
    ])
  })

  describe('Identities', () => {


    it('should i1, i2, i3', () => co(function *() {
      (yield s1.dal.idtyDAL.getSandboxRoom()).should.equal(3);
      yield i1.createIdentity();
      yield i2.createIdentity();
      yield i3.createIdentity();
      (yield s1.dal.idtyDAL.getSandboxRoom()).should.equal(0);
    }));

    it('should reject i4', () => shouldThrow(co(function *() {
      (yield s1.dal.idtyDAL.getSandboxRoom()).should.equal(0);
      yield i4.createIdentity();
    })));

    it('should create i4 by i1->i4', () => co(function *() {
      yield i4.createIdentity(null, s2);
      yield i1.cert(i4, s2);
    }));

    it('should accept i1 (already here) by i4->i1', () => co(function *() {
      yield i4.cert(i1);
    }));

    it('should commit & make room for sandbox, and commit again', () => co(function *() {
      yield i1.join();
      yield i4.join();
      (yield s1.dal.idtyDAL.getSandboxRoom()).should.equal(0);
      yield s1.commit({ time: now });
      (yield s1.dal.idtyDAL.getSandboxRoom()).should.equal(3); // i2, i3 were removed for too old identities (based on virtual root block)
      yield i2.createIdentity();
      yield i3.createIdentity();
      (yield s1.dal.idtyDAL.getSandboxRoom()).should.equal(1);
      yield s1.commit({ time: now });
      yield s2.syncFrom(s1, 0, 1);
      yield s3.syncFrom(s1, 0, 1);
    }));

    it('should create i5(1)', () => co(function *() {
      yield i5.createIdentity();
      (yield s1.dal.idtyDAL.getSandboxRoom()).should.equal(0);
    }));

    it('should reject i7(1)', () => shouldThrow(i7.createIdentity(true)));

    it('should reject i7(1) by revocation', () => shouldThrow(co(function *() {
      yield i7onS2.createIdentity(true);
      const idty = yield i7onS2.lookup(i7onS2.pub);
      yield i7.revoke(idty);
    })));

    it('should reject i1 -> i7 by revocation', () => shouldThrow(co(function *() {
      yield i1.cert(i7, s2);
    })));

    it('should accept i7(1), i8(1), i9(1) by i1->i7(1), i1->i8(1), i1->i9(1)', () => co(function *() {
      (yield s1.dal.idtyDAL.getSandboxRoom()).should.equal(0);
      yield i8.createIdentity(null, s2);
      yield i1.cert(i8, s2);
      (yield s1.dal.idtyDAL.getSandboxRoom()).should.equal(0);
      yield i9.createIdentity(null, s2);
      yield i1.cert(i9, s2);
      (yield s1.dal.idtyDAL.getSandboxRoom()).should.equal(0);
    }));

    it('should reject i10(1) by i1->i10(1)', () => shouldThrow(co(function *() {
      (yield s1.dal.idtyDAL.getSandboxRoom()).should.equal(0);
      yield i10.createIdentity(true, s2);
      yield i1.cert(i10, s2);
    })));

    it('should accept i10(0) by i1->i10(0) because of an superior date compared to others in sandbox', () => co(function *() {
      yield i10.createIdentity(null, s3);
      yield i1.cert(i10, s3);
    }));

    it('should accept i11(0) and i12(0) for the same reason', () => co(function *() {
      yield i11.createIdentity(null, s3);
      yield i12.createIdentity(null, s3);
    }));

    it('should reject i13(0) because absolutely no more room is available', () => shouldThrow(co(function *() {
      yield i13.createIdentity(true, s3);
      yield i1.cert(i13, s3);
    })));

    it('should accept an identity with the same key as server, always', () => co(function *() {
      (yield s3.dal.idtyDAL.getSandboxRoom()).should.equal(0);
      yield i14.createIdentity(null, s3);
    }));

    it('should make room as identities get expired', () => co(function *() {
      yield s1.commit({
        time: now + 1000
      });
      yield s1.commit({
        time: now + 1000
      });
      yield s1.commit({
        time: now + 1000
      });
      (yield s1.dal.idtyDAL.getSandboxRoom()).should.equal(3);
    }));
  });

  describe('Certifications', () => {

    const NEW_VALUE = 3
    const OLD_VALUE = constants.SANDBOX_SIZE_CERTIFICATIONS

    before(() => {
      constants.SANDBOX_SIZE_CERTIFICATIONS = NEW_VALUE
    })

    it('should accept i4->i7(0),i4->i8(0),i4->i9(0)', () => co(function *() {
      yield i7.createIdentity();
      yield i8.createIdentity();
      yield i9.createIdentity();
      (yield s1.dal.certDAL.getSandboxForKey('2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc').getSandboxRoom()).should.equal(3);
      yield i4.cert(i7);
      yield i4.cert(i8);
      yield i4.cert(i9);
      (yield s1.dal.certDAL.getSandboxForKey('2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc').getSandboxRoom()).should.equal(0);
      (yield s1.dal.certDAL.getSandboxForKey('91dWdiyf7KaC4GAiKrwU7nGuue1vvmHqjCXbPziJFYtE').getSandboxRoom()).should.equal(3);
    }));

    it('should reject i4->i10(0)', () => shouldThrow(co(function *() {
      (yield s1.dal.certDAL.getSandboxForKey('2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc').getSandboxRoom()).should.equal(0);
      yield i4.cert(i10);
    })));

    it('should accept a certification from the same key as server, always', () => co(function *() {
      (yield s1.dal.certDAL.getSandboxForKey('2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc').getSandboxRoom()).should.equal(0);
      yield i1.cert(i8);
    }));

    it('should make room as certs get expired', () => co(function *() {
      yield s1.commit({
        time: now + 1000
      });
      (yield s1.dal.certDAL.getSandboxForKey('2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc').getSandboxRoom()).should.equal(3);
    }));

    after(() => {
      constants.SANDBOX_SIZE_CERTIFICATIONS = OLD_VALUE
    })
  });

  describe('Memberships', () => {

    it('should accept i8,i9', () => co(function *() {
      yield i8.createIdentity(); // Identities have changed
      yield i9.createIdentity();
      (yield s1.dal.msDAL.getSandboxRoom()).should.equal(2);
      yield i8.join();
      yield i9.join();
      (yield s1.dal.msDAL.getSandboxRoom()).should.equal(0);
    }));

    it('should reject i7', () => shouldThrow(co(function *() {
      (yield s1.dal.msDAL.getSandboxRoom()).should.equal(0);
      yield i7.join();
    })));

    it('should accept a membership from the same key as server, always', () => co(function *() {
      (yield s1.dal.msDAL.getSandboxRoom()).should.equal(0);
      yield i1.join();
    }));

    it('should make room as membership get expired', () => co(function *() {
      yield s1.commit({
        time: now + 1000
      });
      (yield s1.dal.msDAL.getSandboxRoom()).should.equal(2);
    }));
  });

  describe('Transaction', () => {

    const tmp = CommonConstants.TRANSACTION_MAX_TRIES;

    before(() => {
      CommonConstants.TRANSACTION_MAX_TRIES = 2;
    })

    it('should accept 2 transactions of 20, 30 units', () => co(function *() {
      yield i4.send(20, i1);
      yield i4.send(30, i1);
      (yield s1.dal.txsDAL.getSandboxRoom()).should.equal(0);
    }));

    it('should reject amount of 10', () => shouldThrow(co(function *() {
      yield i4.send(10, i1);
    })));

    it('should accept a transaction from the same key as server, always', () => co(function *() {
      yield i1.send(10, i4);
    }));

    it('should make room as transactions get commited', () => co(function *() {
      yield s1.commit();
      yield s1.commit();
      (yield s1.dal.txsDAL.getSandboxRoom()).should.equal(2);
      CommonConstants.TRANSACTION_MAX_TRIES = tmp;
    }));
  });
});

function shouldThrow(promise) {
  return promise.should.be.rejected();
}
