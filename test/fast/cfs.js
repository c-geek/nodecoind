"use strict";

var assert = require('assert');
var should = require('should');
var co = require('co');
var CFSCore = require('../../app/lib/dal/fileDALs/CFSCore').CFSCore;
var mockFS = require('q-io/fs-mock')({
  'B5_a': {
    "A.json": '{ "text": "Content of A from B5_a" }'
  },
  'B4': {
    'B.json': '{ "text": "Content of B" }'
  },
  'B3': {
    'A.json': '{ "text": "Content of A from B3" }',
    'C.json': '{ "text": "Content of C from B3" }'
  },
  'OTHER': {
    'X.json': '{ "text": "Content of X" }'
  }
});

describe("CFS", () => {

  var coreB3 = new CFSCore('/B3', mockFS);
  var coreB4 = new CFSCore('/B4', mockFS);
  var coreB5 = new CFSCore('/B5_a', mockFS);

  var rootCore = new CFSCore('/OTHER', mockFS);

  // ------------ Direct READ ------------

  it('should have the content of A.json from B5', () => {
    return co(function *() {
      var content = yield coreB5.readJSON('A.json');
      content.should.have.property('text').equal('Content of A from B5_a');
    });
  });

  // WRITE of file /C.json

  it('should have the content of C.json modified from B5 (direct read)', () => {
    return co(function *() {
      yield coreB5.writeJSON('C.json', { text: 'Content of C from B5_a'});
      var content = yield coreB5.readJSON('C.json');
      content.should.have.property('text').equal('Content of C from B5_a');
    });
  });

  // WRITE of file /D.json

  it('should have the content of D.json modified from B4 (direct read/write)', () => {
    return co(function *() {
      yield coreB4.writeJSON('D.json', { text: 'Content of D'});
      var content = yield coreB4.readJSON('D.json');
      content.should.have.property('text').equal('Content of D');
    });
  });

  // REMOVE file /D.json

  it('should have the content of D.json modified from B5 (direct read/write)', () => {
    return co(function *() {
      var exists = yield coreB5.exists('D.json');
      var content = yield coreB5.read('D.json');
      assert.equal(exists, false);
      assert.equal(content, null);
    });
  });

  // ------------ LIST ------------

  it('should have G,H,I as files from /DIR', () => {
    return co(function *() {
      yield coreB3.makeTree('/DIR');
      yield coreB4.makeTree('/DIR');
      yield coreB5.makeTree('/DIR');
      yield coreB3.writeJSON('/DIR/G.json', { text: 'Content of DIR/I'});
      yield coreB4.writeJSON('/DIR/H.json', { text: 'Content of DIR/H'});
      yield coreB5.writeJSON('/DIR/I.json', { text: 'Content of DIR/G'});
      (yield coreB3.list('/DIR')).should.deepEqual(['G.json']);
      (yield coreB4.list('/DIR')).should.deepEqual(['H.json']);
      (yield coreB5.list('/DIR')).should.deepEqual(['I.json']);
    });
  });

  // WRITE of file /DIR2/I.json in B4

  it('should have I as files from /DIR2', () => {
    return co(function *() {
      yield coreB3.makeTree('/DIR2');
      yield coreB3.writeJSON('/DIR2/I.json', { text: 'Content of DIR2/I in B4'});
      var files = yield coreB3.list('/DIR2');
      files.should.have.length(1);
      files.should.deepEqual(['I.json']);
      // Check its contents
      var contents = yield coreB3.listJSON('/DIR2');
      contents.should.have.length(1);
      contents.should.deepEqual([{ text: 'Content of DIR2/I in B4' }]);
    });
  });

  // REMOVE of file /DIR2/I.json in B5

  it('should have no files from /DIR2 after file DELETION', () => {
    return co(function *() {
      yield coreB3.remove('/DIR2/I.json');
      var files = yield coreB3.list('/DIR2');
      files.should.have.length(0);
      // Check its contents
      var contents = yield coreB3.listJSON('/DIR2');
      contents.should.have.length(0);
    });
  });

  describe("Root core", () => {

    it('should have 1 file in /OTHER folder', () => {
      return co(function *() {
        var files = yield rootCore.list('/');
        files.should.have.length(1);
        // Check its contents
        var contents = yield rootCore.listJSON('/');
        contents.should.have.length(1);
        contents.should.deepEqual([{ text: 'Content of X' }]);
      });
    });

    // REMOVE of file /OTHER/X.json in rootCore

    it('should have no files from /OTHER after file DELETION', () => {
      return co(function *() {
        yield rootCore.remove('/X.json');
        var files = yield rootCore.list('/');
        files.should.have.length(0);
        // Check its contents
        var contents = yield rootCore.listJSON('/');
        contents.should.have.length(0);
      });
    });
  });
});
