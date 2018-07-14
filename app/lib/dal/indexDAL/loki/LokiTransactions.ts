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

import * as moment from "moment"
import {TxsDAO} from "../abstract/TxsDAO"
import {SandBox} from "../../sqliteDAL/SandBox"
import {TransactionDTO} from "../../../dto/TransactionDTO"
import {DBTx} from "../../../db/DBTx"
import {Underscore} from "../../../common-libs/underscore"
import {LokiProtocolIndex} from "./LokiProtocolIndex"

const constants = require('../../../constants')

export class LokiTransactions extends LokiProtocolIndex<DBTx> implements TxsDAO {

  constructor(loki: any) {
    super(loki, 'txs', [])
    this.sandbox = new SandBox(
      constants.SANDBOX_SIZE_TRANSACTIONS,
      () => this.getSandboxTxs(),
      (compared: { issuers: string[], output_base: number, output_amount: number },
       reference: { issuers: string[], output_base: number, output_amount: number }
      ) => {
        if (compared.output_base < reference.output_base) {
          return -1;
        }
        else if (compared.output_base > reference.output_base) {
          return 1;
        }
        else if (compared.output_amount > reference.output_amount) {
          return -1;
        }
        else if (compared.output_amount < reference.output_amount) {
          return 1;
        }
        else {
          return 0;
        }
      })
  }

  sandbox: SandBox<{ issuers: string[]; output_base: number; output_amount: number }>

  async addLinked(tx: TransactionDTO, block_number: number, time: number): Promise<DBTx> {
    const dbTx = DBTx.fromTransactionDTO(tx)
    dbTx.block_number = block_number
    dbTx.time = time
    dbTx.received = moment().unix()
    dbTx.written = true
    dbTx.removed = false
    dbTx.hash = tx.getHash()
    await this.insertOrUpdate(dbTx)
    return dbTx
  }

  async addPending(dbTx: DBTx): Promise<DBTx> {
    dbTx.received = moment().unix()
    dbTx.written = false
    dbTx.removed = false
    await this.insertOrUpdate(dbTx)
    return dbTx
  }

  async insertOrUpdate(dbTx: DBTx): Promise<DBTx> {
    const conditions = { hash: dbTx.hash }
    const existing = (await this.findRaw(conditions))[0]
    if (existing) {
      // Existing block: we only allow to change the fork flag
      this.collection
        .chain()
        .find(conditions)
        .update(tx => {
          tx.block_number = dbTx.block_number
          tx.time = dbTx.time
          tx.received = dbTx.received
          tx.written = dbTx.written
          tx.removed = dbTx.removed
          tx.hash = dbTx.hash
        })
    }
    else if (!existing) {
      await this.insert(dbTx)
    }
    return dbTx
  }

  async getAllPending(versionMin: number): Promise<DBTx[]> {
    return this.findRaw({
      written: false,
      removed: false,
      version: {$gte: versionMin}
    })
  }

  async getLinkedWithIssuer(pubkey: string): Promise<DBTx[]> {
    return this.findRaw({
      issuers: {$contains: pubkey},
      written: true
    })
  }

  async getLinkedWithRecipient(pubkey: string): Promise<DBTx[]> {
    const rows = await this.findRaw({
      recipients: {$contains: pubkey},
      written: true
    })
    // Which does not contains the key as issuer
    return Underscore.filter(rows, (row: DBTx) => row.issuers.indexOf(pubkey) === -1);
  }

  async getPendingWithIssuer(pubkey: string): Promise<DBTx[]> {
    return this.findRaw({
      issuers: {$contains: pubkey},
      written: false,
      removed: false
    })
  }

  async getPendingWithRecipient(pubkey: string): Promise<DBTx[]> {
    return this.findRaw({
      recipients: {$contains: pubkey},
      written: false,
      removed: false
    })
  }

  async getTX(hash: string): Promise<DBTx> {
    return (await this.findRaw({
      hash: hash
    }))[0]
  }

  async removeTX(hash: string): Promise<DBTx | null> {
    let txRemoved = null
    await this.collection
      .chain()
      .find({
        hash: hash
      })
      .update(tx => {
        tx.removed = true
        txRemoved = tx
      })
    return txRemoved
  }

  async removeAll(): Promise<void> {
    await this.collection
      .chain()
      .find({})
      .remove()
  }

  async trimExpiredNonWrittenTxs(limitTime: number): Promise<void> {
    await this.collection
      .chain()
      .find({
        written: false,
        blockstampTime: {$lte: limitTime}
      })
      .remove()
  }

  /**************************
   * SANDBOX STUFF
   */

  async getSandboxTxs() {
    // SELECT * FROM txs WHERE NOT written AND NOT removed ORDER BY output_base DESC, output_amount DESC
    // return this.query('SELECT * FROM sandbox_txs LIMIT ' + (this.sandbox.maxSize), [])
    return this.collection
      .chain()
      .find({
        written: false,
        removed: false
      })
      .compoundsort(['output_base', ['output_amount', true]])
      .limit(this.sandbox.maxSize)
      .data()
  }

  getSandboxRoom() {
    return this.sandbox.getSandboxRoom()
  }

  setSandboxSize(maxSize: number) {
    this.sandbox.maxSize = maxSize
  }

}
