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

import {Indexer} from "../../../app/lib/indexer"

const should        = require('should');

const FAIL = false;
const SUCCESS = true;

describe("Protocol BR_G49 - Version", function(){

  it('V13 following V12 should fail', async () => {
    const HEAD_1 = { number: 17, version: 13 } as any
    const HEAD   = { number: 18, version: 12 } as any
    Indexer.ruleVersion(HEAD, HEAD_1).should.equal(FAIL);
  })

  it('V14 following V12 should fail', async () => {
    const HEAD_1 = { number: 17, version: 14 } as any
    const HEAD   = { number: 18, version: 12 } as any
    Indexer.ruleVersion(HEAD, HEAD_1).should.equal(FAIL);
  })

  it('V13 following V14 should succeed', async () => {
    const HEAD_1 = { number: 17, version: 13 } as any
    const HEAD   = { number: 18, version: 14 } as any
    Indexer.ruleVersion(HEAD, HEAD_1).should.equal(SUCCESS);
  })

  it('V13 following V15 should fail', async () => {
    const HEAD_1 = { number: 17, version: 13 } as any
    const HEAD   = { number: 18, version: 15 } as any
    Indexer.ruleVersion(HEAD, HEAD_1).should.equal(FAIL);
  })
})
