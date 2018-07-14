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

import {DuniterBlockchain} from "../blockchain/DuniterBlockchain";
import {BlockDTO} from "../dto/BlockDTO";
import {AccountsGarbagingDAL, FullSindexEntry, Indexer} from "../indexer";
import {CurrencyConfDTO} from "../dto/ConfDTO";
import {FileDAL} from "../dal/fileDAL"
import {DBBlock} from "../db/DBBlock"
import {Underscore} from "../common-libs/underscore"
import {CommonConstants} from "../common-libs/constants"
import {cliprogram} from "../common-libs/programOptions"

const constants = require('../constants')

let sync_bindex: any [] = [];
let sync_iindex: any[] = [];
let sync_mindex: any[] = [];
let sync_cindex: any[] = [];
let sync_sindex: any[] = [];
let sync_bindexSize = 0;
let sync_expires: number[] = [];
let sync_nextExpiring = 0;
let sync_currConf: CurrencyConfDTO;
const sync_memoryWallets: any = {}
const sync_memoryDAL:AccountsGarbagingDAL = {
  getWallet: (conditions: string) => Promise.resolve(sync_memoryWallets[conditions] || { conditions, balance: 0 }),
  saveWallet: async (wallet: any) => {
    // Make a copy
    sync_memoryWallets[wallet.conditions] = {
      conditions: wallet.conditions,
      balance: wallet.balance
    }
  },
  sindexDAL: {
    getAvailableForConditions: (conditions:string) => Promise.resolve([])
  }
}

export class QuickSynchronizer {

  constructor(private conf: any, private dal:FileDAL, private logger: any) {
  }

  async quickApplyBlocks(blocks:BlockDTO[], to: number): Promise<void> {

    sync_memoryDAL.sindexDAL = {
      getAvailableForConditions: (conditions:string) => this.dal.sindexDAL.getAvailableForConditions(conditions)
    }

    await this.dal.blockDAL.insertBatch(blocks.map((b:any) => {
      const block = DBBlock.fromBlockDTO(b)
      block.fork = false
      return block
    }))

    // We only keep approx 2 months of blocks in memory, so memory consumption keeps approximately constant during the sync
    await this.dal.blockDAL.trimBlocks(blocks[blocks.length - 1].number - CommonConstants.BLOCKS_IN_MEMORY_MAX)

    for (const block of blocks) {

      // VERY FIRST: parameters, otherwise we compute wrong variables such as UDTime
      if (block.number == 0) {
        await DuniterBlockchain.saveParametersForRoot(block, this.conf, this.dal)
      }

      // The new kind of object stored
      const dto = BlockDTO.fromJSONObject(block)

      if (block.number == 0) {
        sync_currConf = BlockDTO.getConf(block);
      }

      if (block.number <= to - this.conf.forksize || cliprogram.noSources) { // If we require nosources option, this blockchain can't be valid so we don't make checks
        const index:any = Indexer.localIndex(dto, sync_currConf);
        const local_iindex = Indexer.iindex(index);
        const local_cindex = Indexer.cindex(index);
        const local_sindex = cliprogram.noSources ? [] : Indexer.sindex(index);
        const local_mindex = Indexer.mindex(index);

        const HEAD = await Indexer.quickCompleteGlobalScope(block, sync_currConf, sync_bindex, local_iindex, local_mindex, local_cindex, this.dal)
        sync_bindex.push(HEAD);

        // Remember expiration dates
        for (const entry of index) {
          if (entry.expires_on) {
            sync_expires.push(entry.expires_on)
          }
          if (entry.revokes_on) {
            sync_expires.push(entry.revokes_on)
          }
        }

        await DuniterBlockchain.createNewcomers(local_iindex, this.dal, this.logger)

        if ((block.dividend && !cliprogram.noSources)
          || block.joiners.length
          || block.actives.length
          || block.revoked.length
          || block.excluded.length
          || block.certifications.length
          || (block.transactions.length && !cliprogram.noSources)
          || block.medianTime >= sync_nextExpiring) {
          const nextExpiringChanged = block.medianTime >= sync_nextExpiring

          for (let i = 0; i < sync_expires.length; i++) {
            let expire = sync_expires[i];
            if (block.medianTime >= expire) {
              sync_expires.splice(i, 1);
              i--;
            }
          }
          sync_nextExpiring = sync_expires.reduce((max, value) => max ? Math.min(max, value) : value, 9007199254740991); // Far far away date

          // Fills in correctly the SINDEX
          if (!cliprogram.noSources) {
            await Promise.all(Underscore.where(sync_sindex.concat(local_sindex), {op: 'UPDATE'}).map(async entry => {
              if (!entry.conditions) {
                const src = (await this.dal.getSource(entry.identifier, entry.pos, entry.srcType === 'D')) as FullSindexEntry
                entry.conditions = src.conditions;
              }
            }))
          }

          // Flush the INDEX (not bindex, which is particular)
          await this.dal.flushIndexes({
            mindex: sync_mindex,
            iindex: sync_iindex,
            sindex: sync_sindex,
            cindex: sync_cindex,
          })
          sync_iindex = local_iindex
          sync_cindex = local_cindex
          sync_mindex = local_mindex
          sync_sindex = local_sindex

          // Dividends and account garbaging
          const dividends = cliprogram.noSources ? [] : await Indexer.ruleIndexGenDividend(HEAD, local_iindex, this.dal)
          if (!cliprogram.noSources) {
            sync_sindex = sync_sindex.concat(await Indexer.ruleIndexGarbageSmallAccounts(HEAD, sync_sindex, dividends, sync_memoryDAL));
          }

          if (nextExpiringChanged) {
            sync_cindex = sync_cindex.concat(await Indexer.ruleIndexGenCertificationExpiry(HEAD, this.dal));
            sync_mindex = sync_mindex.concat(await Indexer.ruleIndexGenMembershipExpiry(HEAD, this.dal));
            sync_iindex = sync_iindex.concat(await Indexer.ruleIndexGenExclusionByMembership(HEAD, sync_mindex, this.dal));
            sync_iindex = sync_iindex.concat(await Indexer.ruleIndexGenExclusionByCertificatons(HEAD, sync_cindex, local_iindex, this.conf, this.dal));
            sync_mindex = sync_mindex.concat(await Indexer.ruleIndexGenImplicitRevocation(HEAD, this.dal));
          }

          if (!cliprogram.noSources) {
            // Update balances with UD + local garbagings
            await DuniterBlockchain.updateWallets(sync_sindex, dividends, sync_memoryDAL)
          }

          // Flush the INDEX again (needs to be done *before* the update of wotb links because of block#0)
          await this.dal.flushIndexes({
            mindex: sync_mindex,
            iindex: sync_iindex,
            sindex: sync_sindex,
            cindex: sync_cindex,
          })

          // --> Update links
          await this.dal.updateWotbLinks(local_cindex.concat(sync_cindex));
          sync_iindex = [];
          sync_mindex = [];
          sync_cindex = [];
          sync_sindex = [];

          // Create/Update nodes in wotb
          await DuniterBlockchain.updateMembers(block, this.dal)
        } else {
          // Concat the results to the pending data
          sync_iindex = sync_iindex.concat(local_iindex);
          sync_cindex = sync_cindex.concat(local_cindex);
          sync_mindex = sync_mindex.concat(local_mindex);
        }

        // Trim the bindex
        sync_bindexSize = this.conf.forksize + [
          block.issuersCount,
          block.issuersFrame,
          this.conf.medianTimeBlocks,
          this.conf.dtDiffEval,
          blocks.length
        ].reduce((max, value) => {
          return Math.max(max, value);
        }, 0);

        if (sync_bindexSize && sync_bindex.length >= 2 * sync_bindexSize) {
          // We trim it, not necessary to store it all (we already store the full blocks)
          sync_bindex.splice(0, sync_bindexSize);

          // Process triming & archiving continuously to avoid super long ending of sync
          await this.dal.trimIndexes(sync_bindex[0].number);
        }
      } else {

        // Save the INDEX
        await this.dal.bindexDAL.insertBatch(sync_bindex);
        await this.dal.flushIndexes({
          mindex: sync_mindex,
          iindex: sync_iindex,
          sindex: sync_sindex,
          cindex: sync_cindex,
        })

        // Save the intermediary table of wallets
        const conditions = Underscore.keys(sync_memoryWallets)
        const nonEmptyKeys = Underscore.filter(conditions, (k: any) => sync_memoryWallets[k] && sync_memoryWallets[k].balance > 0)
        const walletsToRecord = nonEmptyKeys.map((k: any) => sync_memoryWallets[k])
        await this.dal.walletDAL.insertBatch(walletsToRecord)
        for (const cond of conditions) {
          delete sync_memoryWallets[cond]
        }

        if (block.number === 0) {
          await DuniterBlockchain.saveParametersForRoot(block, this.conf, this.dal)
        }

        // Last block: cautious mode to trigger all the INDEX expiry mechanisms
        const { index, HEAD } = await DuniterBlockchain.checkBlock(dto, constants.WITH_SIGNATURES_AND_POW, this.conf, this.dal)
        await DuniterBlockchain.pushTheBlock(dto, index, HEAD, this.conf, this.dal, this.logger)

        // Clean temporary variables
        sync_bindex = [];
        sync_iindex = [];
        sync_mindex = [];
        sync_cindex = [];
        sync_sindex = [];
        sync_bindexSize = 0;
        sync_expires = [];
        sync_nextExpiring = 0;
        // sync_currConf = {};
      }
    }
  }
}
