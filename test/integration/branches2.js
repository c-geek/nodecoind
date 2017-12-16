"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const other_constants_1 = require("../../app/lib/other_constants");
const logger_1 = require("../../app/lib/logger");
const index_1 = require("../../app/modules/bma/index");
const index_2 = require("../../app/modules/crawler/index");
const toolbox_1 = require("./tools/toolbox");
const TestUser_1 = require("./tools/TestUser");
const co = require('co');
const _ = require('underscore');
const duniter = require('../../index');
const bma = index_1.BmaDependency.duniter.methods.bma;
const rp = require('request-promise');
const httpTest = require('./tools/http');
const commit = require('./tools/commit');
const sync = require('./tools/sync');
const shutDownEngine = require('./tools/shutDownEngine');
const expectJSON = httpTest.expectJSON;
const expectHttpCode = httpTest.expectHttpCode;
if (other_constants_1.OtherConstants.MUTE_LOGS_DURING_UNIT_TESTS) {
    logger_1.NewLogger().mute();
}
// Trace these errors
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection: ' + reason);
    console.error(reason);
});
const MEMORY_MODE = true;
const commonConf = {
    ipv4: '127.0.0.1',
    currency: 'bb',
    httpLogs: true,
    forksize: 10,
    switchOnHeadAdvance: 6,
    avgGenTime: 30 * 60,
    sigQty: 1
};
let s1, s2, cat, toc;
const now = Math.round(new Date().getTime() / 1000);
describe("SelfFork", function () {
    before(() => co(function* () {
        s1 = duniter('/bb4', MEMORY_MODE, _.extend({
            port: '7781',
            pair: {
                pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd',
                sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'
            }
        }, commonConf));
        s2 = duniter('/bb5', MEMORY_MODE, _.extend({
            port: '7782',
            pair: {
                pub: 'DKpQPUL4ckzXYdnDRvCRKAm1gNvSdmAXnTrJZ7LvM5Qo',
                sec: '64EYRvdPpTfLGGmaX5nijLXRqWXaVz8r1Z1GtaahXwVSJGQRn7tqkxLb288zwSYzELMEG5ZhXSBYSxsTsz1m9y8F'
            }
        }, commonConf));
        cat = new TestUser_1.TestUser('cat', { pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd', sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP' }, { server: s1 });
        toc = new TestUser_1.TestUser('toc', { pub: 'DKpQPUL4ckzXYdnDRvCRKAm1gNvSdmAXnTrJZ7LvM5Qo', sec: '64EYRvdPpTfLGGmaX5nijLXRqWXaVz8r1Z1GtaahXwVSJGQRn7tqkxLb288zwSYzELMEG5ZhXSBYSxsTsz1m9y8F' }, { server: s1 });
        const commitS1 = commit(s1);
        const commitS2 = commit(s2, {
            time: now + 37180
        });
        yield s1.initWithDAL().then(bma).then((bmapi) => bmapi.openConnections());
        yield s2.initWithDAL().then(bma).then((bmapi) => bmapi.openConnections());
        s1.addEndpointsDefinitions(() => index_1.BmaDependency.duniter.methods.getMainEndpoint(s1.conf));
        s2.addEndpointsDefinitions(() => index_1.BmaDependency.duniter.methods.getMainEndpoint(s2.conf));
        // Server 1
        yield cat.createIdentity();
        yield toc.createIdentity();
        yield toc.cert(cat);
        yield cat.cert(toc);
        yield cat.join();
        yield toc.join();
        yield commitS1({
            time: now
        });
        yield commitS1();
        yield commitS1();
        yield commitS1();
        // Server 2
        yield sync(0, 2, s1, s2);
        yield toolbox_1.waitToHaveBlock(s2, 2);
        let s2p = yield s2.PeeringService.peer();
        yield commitS2();
        yield commitS2();
        yield commitS2();
        yield commitS2();
        yield commitS2();
        yield commitS2();
        yield commitS2();
        yield s1.writePeer(s2p);
        // Forking S1 from S2
        yield Promise.all([
            toolbox_1.waitForkResolution(s1, 9),
            index_2.CrawlerDependency.duniter.methods.pullBlocks(s1, s2p.pubkey)
        ]);
    }));
    after(() => {
        return Promise.all([
            shutDownEngine(s1),
            shutDownEngine(s2)
        ]);
    });
    describe("Server 1 /blockchain", function () {
        it('/block/0 should exist', function () {
            return expectJSON(rp('http://127.0.0.1:7781/blockchain/block/0', { json: true }), {
                number: 0,
                issuersCount: 0,
                issuersFrame: 1,
                issuersFrameVar: 0
            });
        });
        it('/block/1 should exist', function () {
            return expectJSON(rp('http://127.0.0.1:7781/blockchain/block/1', { json: true }), {
                number: 1,
                issuersCount: 1,
                issuersFrame: 1,
                issuersFrameVar: 5
            });
        });
        it('/block/2 should exist', function () {
            return expectJSON(rp('http://127.0.0.1:7781/blockchain/block/2', { json: true }), {
                number: 2,
                issuersCount: 1,
                issuersFrame: 2,
                issuersFrameVar: 4
            });
        });
        it('/block/3 should exist', function () {
            return expectJSON(rp('http://127.0.0.1:7781/blockchain/block/3', { json: true }), {
                number: 3,
                issuersCount: 1,
                issuersFrame: 3,
                issuersFrameVar: 3
            });
        });
        it('/block/4 should exist', function () {
            return expectJSON(rp('http://127.0.0.1:7781/blockchain/block/4', { json: true }), {
                number: 4,
                issuersCount: 2,
                issuersFrame: 4,
                issuersFrameVar: 7
            });
        });
        it('/block/5 should exist', function () {
            return expectJSON(rp('http://127.0.0.1:7781/blockchain/block/5', { json: true }), {
                number: 5,
                issuersCount: 2,
                issuersFrame: 5,
                issuersFrameVar: 6
            });
        });
        it('/block/6 should exist', function () {
            return expectJSON(rp('http://127.0.0.1:7781/blockchain/block/6', { json: true }), {
                number: 6,
                issuersCount: 2,
                issuersFrame: 6,
                issuersFrameVar: 5
            });
        });
        it('/block/7 should exist', function () {
            return expectJSON(rp('http://127.0.0.1:7781/blockchain/block/7', { json: true }), {
                number: 7,
                issuersCount: 2,
                issuersFrame: 7,
                issuersFrameVar: 4
            });
        });
        it('/block/88 should not exist', function () {
            return expectHttpCode(404, rp('http://127.0.0.1:7781/blockchain/block/88'));
        });
        it('/current should exist', function () {
            return expectJSON(rp('http://127.0.0.1:7781/blockchain/current', { json: true }), {
                number: 9
            });
        });
        it('should have 2 branch', () => __awaiter(this, void 0, void 0, function* () {
            const branches = yield s1.BlockchainService.branches();
            branches.should.have.length(1);
        }));
    });
    describe("Server 2 /blockchain", function () {
        it('/block/0 should exist', function () {
            return expectJSON(rp('http://127.0.0.1:7782/blockchain/block/0', { json: true }), {
                number: 0
            });
        });
        it('/block/1 should exist', function () {
            return expectJSON(rp('http://127.0.0.1:7782/blockchain/block/1', { json: true }), {
                number: 1
            });
        });
        it('/block/88 should not exist', function () {
            return expectHttpCode(404, rp('http://127.0.0.1:7782/blockchain/block/88'));
        });
        it('/current should exist', function () {
            return expectJSON(rp('http://127.0.0.1:7782/blockchain/current', { json: true }), {
                number: 9
            });
        });
        it('should have 1 branch', () => co(function* () {
            const branches = yield s2.BlockchainService.branches();
            branches.should.have.length(1);
        }));
    });
});
//# sourceMappingURL=branches2.js.map