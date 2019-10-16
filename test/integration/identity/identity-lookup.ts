// Source file from duniter: Crypto-currency software to manage libre currency such as Ğ1
// Copyright (C) 2018  Cedric Moreau <cem.moreau@gmail.com>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

import {NewTestingServer, TestingServer} from "../tools/toolbox"
import {TestUser} from "../tools/TestUser"
import {BmaDependency} from "../../../app/modules/bma/index"
import {Underscore} from "../../../app/lib/common-libs/underscore"
import {HttpLookup, HttpMemberships} from "../../../app/modules/bma/lib/dtos"
import {shutDownEngine} from "../tools/shutdown-engine"
import {expectAnswer} from "../tools/http-expect"

const rp        = require('request-promise');

const MEMORY_MODE = true;
const commonConf = {
  ipv4: '127.0.0.1',
  currency: 'bb'
};

let s1:TestingServer, cat:TestUser, tic1:TestUser, tic2:TestUser

describe("Lookup identity grouping", () => {

  before(async () => {

    s1 = NewTestingServer(
      Underscore.extend({
        name: 'bb12',
        memory: MEMORY_MODE,
        port: '4452',
        pair: {
          pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd',
          sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'
        }
      }, commonConf));

    cat = new TestUser('cat', { pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd', sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'}, { server: s1 });
    tic1 = new TestUser('tic1', { pub: 'DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV', sec: '468Q1XtTq7h84NorZdWBZFJrGkB18CbmbHr9tkp9snt5GiERP7ySs3wM8myLccbAAGejgMRC9rqnXuW3iAfZACm7'}, { server: s1 });
    tic2 = new TestUser('tic2', { pub: 'DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV', sec: '468Q1XtTq7h84NorZdWBZFJrGkB18CbmbHr9tkp9snt5GiERP7ySs3wM8myLccbAAGejgMRC9rqnXuW3iAfZACm7'}, { server: s1 });

    // Server initialization
    await s1.initWithDAL().then(BmaDependency.duniter.methods.bma).then((bmapi) => bmapi.openConnections());

    // cat is publishing its identity, no problem
    await cat.createIdentity();

    // tic1 is publishing its identity
    await tic1.createIdentity();

    // tic2 is publishing its identity, but he has **the same pubkey as tic1**.
    // This is OK on the protocol side, but the lookup should group the 2 identities
    // under the same pubkey
    await tic2.createIdentity();

    await cat.join();
    await tic1.join();
  })

  after(() => {
    return Promise.all([
      shutDownEngine(s1)
    ])
  })

  it('cat should have only 1 identity in 1 pubkey', () => expectAnswer(rp('http://127.0.0.1:4452/wot/lookup/cat', { json: true }), (res:HttpLookup) => {
    res.should.have.property('results').length(1);
    // cat pubkey
    res.results[0].should.have.property('pubkey').equal('HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd');
    // only 1 UID
    res.results[0].should.have.property('uids').length(1);
    // which is cat
    res.results[0].uids[0].should.have.property('uid').equal('cat');
  }));

  it('tic should have only 2 identities in 1 pubkey', () => expectAnswer(rp('http://127.0.0.1:4452/wot/lookup/tic', { json: true }), (res:HttpLookup) => {
    // We want to have only 1 result for the 2 identities
    res.should.have.property('results').length(1);
    // because they share the same pubkey
    res.results[0].should.have.property('pubkey').equal('DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV');
    // but got 2 UIDs
    res.results[0].should.have.property('uids').length(2);
    // which are tic1
    res.results[0].uids[0].should.have.property('uid').equal('tic1');
    // which are tic2
    res.results[0].uids[1].should.have.property('uid').equal('tic2');
  }));

  it('should exist 2 pending memberships', () => expectAnswer(rp('http://127.0.0.1:4452/wot/pending', { json: true }), (res:HttpMemberships) => {
    res.should.have.property('memberships').length(2);
    res.memberships[0].should.have.property('pubkey').equal('DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV');
    res.memberships[0].should.have.property('uid').equal('tic1');
    res.memberships[0].should.have.property('version').equal(10);
    res.memberships[0].should.have.property('currency').equal('bb');
    res.memberships[0].should.have.property('membership').equal('IN');
    res.memberships[0].should.have.property('blockNumber').equal(0);
    res.memberships[0].should.have.property('blockHash').equal('E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855');
    res.memberships[0].should.have.property('written').equal(null);
  }));
});
