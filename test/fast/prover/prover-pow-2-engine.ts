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

import {PowEngine} from "../../../app/modules/prover/lib/engine"
import {NewLogger} from "../../../app/lib/logger"

const should = require('should');
const logger = NewLogger()

describe('PoW Engine', () => {

  it('should be configurable', async () => {
    const e1 = new PowEngine({ nbCores: 1 } as any, logger);
    (await e1.setConf({ cpu: 0.2, prefix: '34' })).should.deepEqual({ cpu: 0.2, prefix: '34' });
    await e1.shutDown()
  })

  it('should be able to make a proof', async () => {
    const e1 = new PowEngine({ nbCores: 1 } as any, logger);
    const block = { number: 35 };
    const zeros = 2;
    const highMark = 'A';
    const pair = {
      pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd',
      sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'
    };
    const forcedTime = 1;
    const medianTimeBlocks = 20;
    const avgGenTime = 5 * 60;
    const proof = await e1.prove({
        newPoW: {
          block,
          zeros,
          highMark,
          pair,
          forcedTime,
          conf: {
            medianTimeBlocks,
            avgGenTime
          }
        }
      }
    )
    proof.should.deepEqual({
      pow: {
        block: {
          number: 35,
          time: 1,
          inner_hash: '51937F1192447A96537D10968689F4F48859E2DD6F8F9E8DE1006C9697C6C940',
          nonce: 212,
          hash: '009A52E6E2E4EA7DE950A2DA673114FA55B070EBE350D75FF0C62C6AAE9A37E5',
          signature: 'bkmLGX7LNVkuOUMc+/HT6fXJajQtR5uk87fetIntMbGRZjychzu0whl5+AOOGlf+ilp/ara5UK6ppxyPcJIJAg=='
        },
        testsCount: 211,
        pow: '009A52E6E2E4EA7DE950A2DA673114FA55B070EBE350D75FF0C62C6AAE9A37E5'
      }
    });
    await e1.shutDown()
  })

  it('should be able to stop a proof', async () => {
    const e1 = new PowEngine({ nbCores: 1 } as any, logger);
    await e1.forceInit()
    const block = { number: 26 };
    const zeros = 10; // Requires hundreds of thousands of tries probably
    const highMark = 'A';
    const pair = {
      pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd',
      sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'
    };
    const forcedTime = 1;
    const medianTimeBlocks = 20;
    const avgGenTime = 5 * 60;
    const proofPromise = e1.prove({
        newPoW: {
          block,
          zeros,
          highMark,
          pair,
          forcedTime,
          conf: {
            medianTimeBlocks,
            avgGenTime
          }
        }
      }
    )
    await new Promise((res) => setTimeout(res, 10))
    await e1.cancel()
    // const proof = await proofPromise;
    // should.not.exist(proof);
    await e1.shutDown()
  })
})
