import * as stream from "stream"
import {NewLogger} from "../../../lib/logger"
import {CertificationDTO} from "../../../lib/dto/CertificationDTO"
import {IdentityDTO} from "../../../lib/dto/IdentityDTO"
import {BlockDTO} from "../../../lib/dto/BlockDTO"
import {MembershipDTO} from "../../../lib/dto/MembershipDTO"
import {TransactionDTO} from "../../../lib/dto/TransactionDTO"
import {PeerDTO} from "../../../lib/dto/PeerDTO"
import {WS2PConstants} from "./constants"

const logger = NewLogger()

export class WS2PSingleWriteStream extends stream.Transform {

  private detections:{
    [k:string]: number
  } = {}

  constructor(private protectionDuration = 1000 * WS2PConstants.SINGLE_RECORD_PROTECTION_IN_SECONDS) {
    super({ objectMode: true })
  }

  getNbProtectionsCurrently() {
    return Object.keys(this.detections).length
  }

  async _write(obj:any, enc:any, done:any) {
    let documentHash = ''
    let doStream = false
    try {

      if (obj.joiners) {
        const dto = BlockDTO.fromJSONObject(obj)
        documentHash = dto.getHash()
      }
      else if (obj.pubkey && obj.uid) {
        const dto = IdentityDTO.fromJSONObject(obj)
        documentHash = dto.getHash()
      }
      else if (obj.idty_uid) {
        const dto = CertificationDTO.fromJSONObject(obj)
        documentHash = dto.getHash()
      }
      else if (obj.userid) {
        const dto = MembershipDTO.fromJSONObject(obj)
        documentHash = dto.getHash()
      }
      else if (obj.issuers) {
        const dto = TransactionDTO.fromJSONObject(obj)
        documentHash = dto.getHash()
      }
      else if (obj.endpoints) {
        const dto = PeerDTO.fromJSONObject(obj)
        documentHash = dto.getHash()
      }

      if (documentHash) {
        if (!this.detections[documentHash]) {
          doStream = true
          this.detections[documentHash] = 1
        } else {
          this.detections[documentHash]++
          logger.warn('WS2P OUT => Document detected %s times: %s', this.detections[documentHash], JSON.stringify(obj))
        }

        setTimeout(() => {
          delete this.detections[documentHash]
        }, this.protectionDuration)
      }

      if (doStream) {
        this.push(obj)
      }

    } catch (e) {
      logger.warn('WS2P >> SingleWrite >>', e)
    }

    done && done()
  }
}
