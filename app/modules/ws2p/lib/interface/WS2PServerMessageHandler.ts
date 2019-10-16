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

import {WS2PMessageHandler} from "../impl/WS2PMessageHandler"
import {WS2PResponse} from "../impl/WS2PResponse"
import {Server} from "../../../../../server"
import {WS2PReqMapperByServer} from "../impl/WS2PReqMapperByServer"
import {WS2PReqMapper} from "./WS2PReqMapper"
import {BlockDTO} from "../../../../lib/dto/BlockDTO"
import {IdentityDTO} from "../../../../lib/dto/IdentityDTO"
import {CertificationDTO} from "../../../../lib/dto/CertificationDTO"
import {MembershipDTO} from "../../../../lib/dto/MembershipDTO"
import {TransactionDTO} from "../../../../lib/dto/TransactionDTO"
import {PeerDTO} from "../../../../lib/dto/PeerDTO"
import {WS2P_REQ} from "../WS2PRequester"
import {WS2PCluster} from "../WS2PCluster"
import {WS2PConnection} from "../WS2PConnection"
import {WS2PConstants} from "../constants"
import {CommonConstants} from "../../../../lib/common-libs/constants"
import {DataErrors} from "../../../../lib/common-libs/errors"

export enum WS2P_REQERROR {
  UNKNOWN_REQUEST
}

export class WS2PServerMessageHandler implements WS2PMessageHandler {

  protected mapper:WS2PReqMapper
  private errors:{
    [k:string]: {
      createdOn: number,
      pubkeys: {
        [p:string]: any[]
      }
    }
  } = {}

  constructor(protected server:Server, protected cluster:WS2PCluster) {
    this.mapper = new WS2PReqMapperByServer(server)
  }

  async handlePushMessage(json: any, c:WS2PConnection): Promise<void> {

    if (c.isSync) {
      // Push messages are forbidden on sync connection
      c.close()
      return
    }

    let documentHash = ''
    try {
      if (json.body) {
        if (json.body.block) {
          const dto = BlockDTO.fromJSONObject(json.body.block)
          const raw = dto.getRawSigned()
          documentHash = dto.getHash()
          await this.server.writeRawBlock(raw)
        }
        else if (json.body.identity) {
          const dto = IdentityDTO.fromJSONObject(json.body.identity)
          const raw = dto.getRawSigned()
          documentHash = dto.getHash()
          await this.server.writeRawIdentity(raw)
        }
        else if (json.body.certification) {
          const dto = CertificationDTO.fromJSONObject(json.body.certification)
          const raw = dto.getRawSigned()
          documentHash = dto.getHash()
          await this.server.writeRawCertification(raw)
        }
        else if (json.body.membership) {
          const dto = MembershipDTO.fromJSONObject(json.body.membership)
          const raw = dto.getRawSigned()
          documentHash = dto.getHash()
          await this.server.writeRawMembership(raw)
        }
        else if (json.body.transaction) {
          const dto = TransactionDTO.fromJSONObject(json.body.transaction)
          const raw = dto.getRaw()
          documentHash = dto.getHash()
          await this.server.writeRawTransaction(raw)
        }
        else if (json.body.peer) {
          const dto = PeerDTO.fromJSONObject(json.body.peer)
          const raw = dto.getRawSigned()
          documentHash = dto.getHash()
          await this.server.writeRawPeer(raw)
        }
        else if (json.body.heads && typeof json.body.heads === "object" && json.body.heads.length !== undefined) {
          if (!json.body.heads.length) {
            documentHash = 'HEADs'
            throw "Heads empty HEADs received"
          }
          await this.cluster.headsReceived(json.body.heads || [])
        }
      }
    } catch(e) {
      if (documentHash
        && this.errors[documentHash]
        && this.errors[documentHash].pubkeys[c.pubkey] !== undefined
        && this.server.conf.pair.pub !== c.pubkey) { // We do not want to ban ourselves
        this.errors[documentHash].pubkeys[c.pubkey].push(json.body)
        if (this.errors[documentHash].pubkeys[c.pubkey].length >= WS2PConstants.BAN_ON_REPEAT_THRESHOLD) {
          let message = "peer " + (c.pubkey || '--unknown--') + " sent " + WS2PConstants.BAN_ON_REPEAT_THRESHOLD + " times a same wrong document: " + (e && (e.message || (e.uerr && e.uerr.message)) || JSON.stringify(e))
          this.cluster.banConnection(c, message)
          for (const body of this.errors[documentHash].pubkeys[c.pubkey]) {
            message += '\n => ' + JSON.stringify(body)
          }
        } else {
          let message = "WS2P IN => " + (c.pubkey || '--unknown--') + " sent " + this.errors[documentHash].pubkeys[c.pubkey].length + " times a same wrong document: " + (e && (e.message || (e.uerr && e.uerr.message)) || JSON.stringify(e))
          for (const body of this.errors[documentHash].pubkeys[c.pubkey]) {
            message += '\n => ' + JSON.stringify(body)
          }
          this.server.logger.warn(message)
        }
        setTimeout(() => {
          if (this.errors[documentHash]) {
            delete this.errors[documentHash]
          }
        }, 1000 * WS2PConstants.ERROR_RECALL_DURATION_IN_SECONDS)
      } else {
        // Remember the error for some time
        if (!this.errors[documentHash]) {
          this.errors[documentHash] = {
            createdOn: Date.now(),
            pubkeys: {}
          }
        }
        this.errors[documentHash].pubkeys[c.pubkey] = [json.body]
        setTimeout(() => {
          if (this.errors[documentHash]) {
            delete this.errors[documentHash]
          }
        }, 1000 * WS2PConstants.ERROR_RECALL_DURATION_IN_SECONDS)
      }
      if (e !== "Block already known"
        && (!e.uerr
            || !(e.uerr.ucode == CommonConstants.ERRORS.DOCUMENT_BEING_TREATED.uerr.ucode
                || e.uerr.ucode == CommonConstants.ERRORS.PEER_DOCUMENT_ALREADY_KNOWN.uerr.ucode))) {
        this.server.logger.warn(e)
      }
    }
  }

  async answerToRequest(data: any, c:WS2PConnection): Promise<WS2PResponse> {

    /**********
     * REQUEST
     *********/

    let body:any = {}

    const forbiddenRequestsForSync: string[] = [] // For now, no WS2P requests are forbidden
    if (c.isSync && (!data || !data.name || forbiddenRequestsForSync.indexOf(data.name) !== -1)) {
      // Some messages are forbidden on sync connection
      c.close()
      throw Error(DataErrors[DataErrors.WS2P_SYNC_PERIMETER_IS_LIMITED])
    }

    if (data && data.name) {
      switch (data.name) {

        case WS2P_REQ[WS2P_REQ.CURRENT]:
          body = await this.mapper.getCurrent()
          break;

        case WS2P_REQ[WS2P_REQ.BLOCK_BY_NUMBER]:
          if (isNaN(data.params.number)) {
            throw "Wrong param `number`"
          }
          const number:number = data.params.number
          body = await this.mapper.getBlock(number)
          break;

        case WS2P_REQ[WS2P_REQ.BLOCKS_CHUNK]:
          if (isNaN(data.params.count)) {
            throw "Wrong param `count`"
          }
          if (isNaN(data.params.fromNumber)) {
            throw "Wrong param `fromNumber`"
          }
          const count:number = data.params.count
          const fromNumber:number = data.params.fromNumber
          body = await this.mapper.getBlocks(count, fromNumber)
          break;

        case WS2P_REQ[WS2P_REQ.WOT_REQUIREMENTS_OF_PENDING]:
          if (isNaN(data.params.minCert)) {
            throw "Wrong param `minCert`"
          }
          const minCert:number = data.params.minCert
          body = await this.mapper.getRequirementsOfPending(minCert)
          break;

        case WS2P_REQ[WS2P_REQ.PEER_DOCUMENT]:
          body = await this.mapper.getPeer()
          break;

        case WS2P_REQ[WS2P_REQ.KNOWN_PEERS]:
          body = await this.mapper.getKnownPeers()
          break;

        case WS2P_REQ[WS2P_REQ.MILESTONES_PAGE]:
          body = await this.mapper.getMilestonesPage()
          break;

        case WS2P_REQ[WS2P_REQ.MILESTONES]:
          if (isNaN(data.params.page)) {
            throw "Wrong param `page`"
          }
          const page:number = data.params.page
          body = await this.mapper.getMilestones(page)
          break;

        default:
          throw Error(WS2P_REQERROR[WS2P_REQERROR.UNKNOWN_REQUEST])
      }
    }

    return body
  }
}