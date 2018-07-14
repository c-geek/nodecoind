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

import {ConfDTO} from "../lib/dto/ConfDTO"
import {Server} from "../../server"
import {moment} from "../lib/common-libs/moment"
import {DBBlock} from "../lib/db/DBBlock"
import {SindexEntry} from "../lib/indexer"
import {BlockDTO} from "../lib/dto/BlockDTO"

const Table = require('cli-table')

module.exports = {
  duniter: {
    cli: [{
      name: 'dump [what] [name] [cond]',
      desc: 'Dumps data of the blockchain.',
      logs: false,
      preventIfRunning: true,

      onDatabaseExecute: async (server:Server, conf:ConfDTO, program:any, params:any) => {
        const what: string = params[0] || ''
        const name: string = params[1] || ''
        const cond: string = params[2] || ''
        switch (what) {

          case 'current':
            await dumpCurrent(server)
            break

          case 'table':
            await dumpTable(server, name, cond)
            break

          case 'history':
            await dumpHistory(server, name)
            break

          default:
            console.error(`Unknown dump ${what}`)
            break
        }
        // Save DB
        await server.disconnect();
      }
    }]
  }
}

async function dumpCurrent(server: Server) {
  const current = await server.dal.getCurrentBlockOrNull()
  if (!current) {
    console.log('')
  }
  else {
    console.log(BlockDTO.fromJSONObject(current).getRawSigned())
  }
}

async function dumpTable(server: Server, name: string, condition?: string) {
  const criterion: any = {}
  const filters = condition && condition.split(',') || []
  for (const f of filters) {
    const k = f.split('=')[0]
    const v = f.split('=')[1]
    if (v === 'true' || v === 'false') {
      criterion[k] = v === 'true' ? true : 0
    } else if (v === 'NULL') {
      criterion[k] = null
    } else if (v.match(/^\d+$/)) {
      criterion[k] = parseInt(v)
    } else {
      criterion[k] = v
    }
  }
  let rows: any[]
  switch (name) {
    case 'i_index':
      rows = await server.dal.iindexDAL.findRawWithOrder(criterion, [['writtenOn', false], ['wotb_id', false]])
      dump(rows, ['op','uid','pub','hash','sig','created_on','written_on','member','wasMember','kick','wotb_id'])
      break
    case 'm_index':
      rows = await server.dal.mindexDAL.findRawWithOrder(criterion, [['writtenOn', false], ['pub', false]])
      dump(rows, ['op','pub','created_on','written_on','expires_on','expired_on','revokes_on','revoked_on','leaving','revocation','chainable_on'])
      break
    case 'c_index':
      rows = await server.dal.cindexDAL.findRawWithOrder(criterion, [['writtenOn', false], ['issuer', false], ['receiver', false]])
      dump(rows, ['op','issuer','receiver','created_on','written_on','sig','expires_on','expired_on','chainable_on','from_wid','to_wid'])
      break
    case 's_index':
      const rowsTX = await server.dal.sindexDAL.findRawWithOrder(criterion, [['writtenOn', false], ['identifier', false], ['pos', false]])
      const rowsUD = await server.dal.dividendDAL.findForDump(criterion)
      rows = rowsTX.concat(rowsUD)
      sortSindex(rows)
      dump(rows, ['op','tx','identifier','pos','created_on','amount','base','locktime','consumed','conditions', 'writtenOn'])
      break
    default:
      console.error(`Unknown dump table ${name}`)
      break
  }
}

function dump(rows: any[], columns: string[]) {
  // Table columns
  const t = new Table({
    head: columns
  });
  for (const row of rows) {
    t.push(columns.map((c) => {
      if (row[c] === null) {
        return "NULL"
      }
      else if (row[c] === undefined) {
        return 'NULL'
      }
      else if (typeof row[c] === 'boolean') {
        return row[c] ? 1 : 0
      }
      return row[c]
    }));
  }
  try {
    const dumped = t.toString()
    console.log(dumped)
  } catch (e) {
    console.error(e)
  }
}

async function dumpHistory(server: Server, pub: string) {
  const irows = await server.dal.iindexDAL.findRawWithOrder({ pub }, [['writtenOn', false]])
  const mrows = await server.dal.mindexDAL.findRawWithOrder({ pub }, [['writtenOn', false]])
  console.log('----- IDENTITY -----')
  for (const e of irows) {
    const date = await getDateFor(server, e.written_on)
    if (e.uid) {
      console.log('%s: new identity %s (created on %s)', date, e.uid, await getDateFor(server, e.created_on as string))
    } else if (e.member) {
      console.log('%s: comeback', date)
    } else if (e.kick) {
      // console.log('%s: being kicked... (either)', date)
    } else if (e.member === false) {
      console.log('%s: excluded', date)
    } else {
      console.log('Non displayable IINDEX entry')
    }
  }
  console.log('----- MEMBERSHIP -----')
  for (const e of mrows) {
    const date = await getDateFor(server, e.written_on)
    if (e.chainable_on) {
      console.log('%s: join/renew', date)
    } else if (e.expired_on) {
      console.log('%s: expired', date)
    } else if (e.revoked_on) {
      console.log('%s: revoked', date)
    } else {
      console.log('Non displayable MINDEX entry')
    }
  }
}

async function getDateFor(server: Server, blockstamp: string) {
  const b = (await server.dal.getAbsoluteBlockByBlockstamp(blockstamp)) as DBBlock
  const s = "         " + b.number
  const bnumberPadded = s.substr(s.length - 6)
  return formatTimestamp(b.medianTime) + ' (#' + bnumberPadded + ')'
}

function formatTimestamp(ts: number) {
  return moment(ts * 1000).format('YYYY-MM-DD hh:mm:ss')
}

function sortSindex(rows: SindexEntry[]) {
  // We sort by writtenOn, identifier, pos
  rows.sort((a, b) => {
    if (a.writtenOn === b.writtenOn) {
      if (a.identifier === b.identifier) {
        if (a.pos === b.pos) {
          return a.op === 'CREATE' && b.op === 'UPDATE' ? -1 : (a.op === 'UPDATE' && b.op === 'CREATE' ? 1 : 0)
        } else {
          return a.pos < b.pos ? -1 : 1
        }
      }
      else {
        return a.identifier < b.identifier ? -1 : 1
      }
    }
    else {
      return a.writtenOn < b.writtenOn ? -1 : 1
    }
  })
}