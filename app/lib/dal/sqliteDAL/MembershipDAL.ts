import {SQLiteDriver} from "../drivers/SQLiteDriver";
import {AbstractSQLite} from "./AbstractSQLite";
import { SandBox } from './SandBox';
import { DBDocument } from './DocumentDAL';
const _ = require('underscore');
const constants = require('../../constants');

export interface DBMembership extends DBDocument {
  membership: string
  issuer: string
  number: number
  blockNumber: number
  blockHash: string
  userid: string
  certts: string
  block: string
  fpr: string
  idtyHash: string
  written: boolean
  written_number: number | null
  expires_on: number
  signature: string
  expired: boolean | null,
  block_number: number
}

export class MembershipDAL extends AbstractSQLite<DBMembership> {

  constructor(driver:SQLiteDriver) {
    super(
      driver,
      'membership',
      // PK fields
      ['issuer','signature'],
      // Fields
      [
        'membership',
        'issuer',
        'number',
        'blockNumber',
        'blockHash',
        'userid',
        'certts',
        'block',
        'fpr',
        'idtyHash',
        'written',
        'written_number',
        'expires_on',
        'signature',
        'expired'
      ],
      // Arrays
      [],
      // Booleans
      ['written'],
      // BigIntegers
      [],
      // Transient
      []
    )
  }

  async init() {
    await this.exec('BEGIN;' +
      'CREATE TABLE IF NOT EXISTS membership (' +
      'membership CHAR(2) NOT NULL,' +
      'issuer VARCHAR(50) NOT NULL,' +
      'number INTEGER NOT NULL,' +
      'blockNumber INTEGER,' +
      'blockHash VARCHAR(64) NOT NULL,' +
      'userid VARCHAR(255) NOT NULL,' +
      'certts VARCHAR(100) NOT NULL,' +
      'block INTEGER,' +
      'fpr VARCHAR(64),' +
      'idtyHash VARCHAR(64),' +
      'written BOOLEAN NOT NULL,' +
      'written_number INTEGER,' +
      'expires_on INTEGER NULL,' +
      'signature VARCHAR(50),' +
      'PRIMARY KEY (issuer,signature)' +
      ');' +
      'CREATE INDEX IF NOT EXISTS idx_mmembership_idtyHash ON membership (idtyHash);' +
      'CREATE INDEX IF NOT EXISTS idx_mmembership_membership ON membership (membership);' +
      'CREATE INDEX IF NOT EXISTS idx_mmembership_written ON membership (written);' +
      'COMMIT;')
  }

  getMembershipsOfIssuer(issuer:string) {
    return this.sqlFind({
      issuer: issuer
    })
  }

  getPendingINOfTarget(hash:string) {
    return this.sqlFind({
      idtyHash: hash,
      membership: 'IN'
    })
  }

  getPendingIN() {
    return this.sqlFind({
      membership: 'IN'
    })
  }

  getPendingOUT() {
    return this.sqlFind({
      membership: 'OUT'
    })
  }

  savePendingMembership(ms:DBMembership) {
    ms.membership = ms.membership.toUpperCase();
    ms.written = false;
    return this.saveEntity(_.pick(ms, 'membership', 'issuer', 'number', 'blockNumber', 'blockHash', 'userid', 'certts', 'block', 'fpr', 'idtyHash', 'expires_on', 'written', 'written_number', 'signature'))
  }

  async deleteMS(ms:DBMembership) {
    await this.deleteEntity(ms)
  }

  async trimExpiredMemberships(medianTime:number) {
    await this.exec('DELETE FROM ' + this.table + ' WHERE expires_on IS NULL OR expires_on < ' + medianTime)
  }

  /**************************
   * SANDBOX STUFF
   */

  getSandboxMemberships() {
    return this.query('SELECT * FROM sandbox_memberships LIMIT ' + (this.sandbox.maxSize), [])
  }

  sandbox = new SandBox(constants.SANDBOX_SIZE_MEMBERSHIPS, this.getSandboxMemberships.bind(this), (compared:DBMembership, reference:DBMembership) => {
    if (compared.block_number < reference.block_number) {
      return -1;
    }
    else if (compared.block_number > reference.block_number) {
      return 1;
    }
    else {
      return 0;
    }
  });

  getSandboxRoom() {
    return this.sandbox.getSandboxRoom()
  }

  setSandboxSize(maxSize:number) {
    this.sandbox.maxSize = maxSize
  }
}
