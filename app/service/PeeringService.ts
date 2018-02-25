import {ConfDTO} from "../lib/dto/ConfDTO"
import {FileDAL} from "../lib/dal/fileDAL"
import {DBPeer} from "../lib/dal/sqliteDAL/PeerDAL"
import {DBBlock} from "../lib/db/DBBlock"
import {Multicaster} from "../lib/streams/multicaster"
import {PeerDTO} from "../lib/dto/PeerDTO"
import {verify} from "../lib/common-libs/crypto/keyring"
import {dos2unix} from "../lib/common-libs/dos2unix"
import {rawer} from "../lib/common-libs/index"
import {Server} from "../../server"
import {GlobalFifoPromise} from "./GlobalFifoPromise"

const util           = require('util');
const _              = require('underscore');
const events         = require('events');
const logger         = require('../lib/logger').NewLogger('peering');
const constants      = require('../lib/constants');

export interface Keyring {
  publicKey:string
  secretKey:string
}

// Note: for an unknown reason, PeeringService cannot extend FIFOService correctly. When this.pushFIFO() is called
// from within submitp(), "this.pushFIFO === undefined" is true.
export class PeeringService {

  conf:ConfDTO
  dal:FileDAL
  selfPubkey:string
  pair:Keyring
  pubkey:string
  peerInstance:DBPeer | null
  logger:any

  constructor(private server:Server, private fifoPromiseHandler:GlobalFifoPromise) {
  }

  setConfDAL(newConf:ConfDTO, newDAL:FileDAL, newPair:Keyring) {
    this.dal = newDAL;
    this.conf = newConf;
    this.pair = newPair;
    this.pubkey = this.pair.publicKey;
    this.selfPubkey = this.pubkey;
    this.logger = require('../lib/logger').NewLogger(this.dal.profile)
  }

  async peer(newPeer:DBPeer | null = null) {
    if (newPeer) {
      this.peerInstance = newPeer;
    }
    let thePeer = this.peerInstance;
    if (!thePeer) {
      thePeer = await this.generateSelfPeer(this.conf)
    }
    return PeerDTO.fromJSONObject(thePeer)
  }

  async mirrorBMAEndpoints() {
    const localPeer = await this.peer();
    const localEndpoints = await this.server.getEndpoints()
    return this.getOtherEndpoints(localPeer.endpoints, localEndpoints).filter((ep) => ep.match(/^BASIC_MERKLED_API/))
  }

  checkPeerSignature(p:PeerDTO) {
    const raw = rawer.getPeerWithoutSignature(p);
    const sig = p.signature;
    const pub = p.pubkey;
    const signaturesMatching = verify(raw, sig, pub);
    return !!signaturesMatching;
  };

  submitP(peering:DBPeer, eraseIfAlreadyRecorded = false, cautious = true): Promise<PeerDTO> {
    // Force usage of local currency name, do not accept other currencies documents
    peering.currency = this.conf.currency || peering.currency;
    let thePeerDTO = PeerDTO.fromJSONObject(peering)
    let thePeer = thePeerDTO.toDBPeer()
    let sp = thePeer.block.split('-');
    const blockNumber = parseInt(sp[0]);
    let blockHash = sp[1];
    let sigTime = 0;
    let block:DBBlock | null;
    let makeCheckings = cautious || cautious === undefined;
    const hash = thePeerDTO.getHash()
    return this.fifoPromiseHandler.pushFIFOPromise<PeerDTO>(hash, async () => {
      try {
        if (makeCheckings) {
          let goodSignature = this.checkPeerSignature(thePeerDTO)
          if (!goodSignature) {
            throw 'Signature from a peer must match';
          }
        }
        if (thePeer.block == constants.PEER.SPECIAL_BLOCK) {
          thePeer.statusTS = 0;
          thePeer.status = 'UP';
        } else {
          block = await this.dal.getBlockByNumberAndHashOrNull(blockNumber, blockHash);
          if (!block && makeCheckings) {
            throw constants.ERROR.PEER.UNKNOWN_REFERENCE_BLOCK;
          } else if (!block) {
            thePeer.block = constants.PEER.SPECIAL_BLOCK;
            thePeer.statusTS = 0;
            thePeer.status = 'UP';
          }
        }
        sigTime = block ? block.medianTime : 0;
        thePeer.statusTS = sigTime;
        let found = await this.dal.getPeerOrNull(thePeer.pubkey);
        let peerEntityOld = PeerDTO.fromJSONObject(found || thePeer)
        if(!found && thePeerDTO.endpoints.length === 0){
          throw 'Peer with zero endpoints that is not already known'
        }
        else if(found){
          // Already existing peer
          const sp2 = found.block.split('-');
          const previousBlockNumber = parseInt(sp2[0]);
          const interfacesChanged = thePeerDTO.endpointSum() != peerEntityOld.endpointSum()
          const isOutdatedDocument = blockNumber < previousBlockNumber && !eraseIfAlreadyRecorded;
          const isAlreadyKnown = blockNumber == previousBlockNumber && !eraseIfAlreadyRecorded;
          if (isOutdatedDocument){
            const error = _.extend({}, constants.ERRORS.NEWER_PEER_DOCUMENT_AVAILABLE);
            _.extend(error.uerr, { peer: found });
            throw error;
          } else if (isAlreadyKnown) {
            throw constants.ERRORS.PEER_DOCUMENT_ALREADY_KNOWN;
          }
          peerEntityOld = PeerDTO.fromJSONObject(found)
          if (interfacesChanged) {
            // Warns the old peer of the change
            const caster = new Multicaster();
            caster.sendPeering(PeerDTO.fromJSONObject(peerEntityOld), PeerDTO.fromJSONObject(thePeer))
          }
          peerEntityOld.version = thePeer.version
          peerEntityOld.currency = thePeer.currency
          peerEntityOld.pubkey = thePeer.pubkey
          peerEntityOld.endpoints = thePeer.endpoints
          peerEntityOld.status = thePeer.status
          peerEntityOld.signature = thePeer.signature
          peerEntityOld.blockstamp = thePeer.block
        }
        // Set the peer as UP again
        const peerEntity = peerEntityOld.toDBPeer()
        peerEntity.statusTS = thePeer.statusTS
        peerEntity.block = thePeer.block
        peerEntity.status = 'UP';
        peerEntity.first_down = null;
        peerEntity.last_try = null;
        peerEntity.hash = peerEntityOld.getHash()
        peerEntity.raw = peerEntityOld.getRaw();
        await this.dal.savePeer(peerEntity);
        this.logger.info('✔ PEER %s', peering.pubkey.substr(0, 8))
        let savedPeer = PeerDTO.fromJSONObject(peerEntity).toDBPeer()
        if (peerEntity.pubkey == this.selfPubkey) {
          const localEndpoints = await this.server.getEndpoints()
          const localNodeNotListed = !peerEntityOld.containsAllEndpoints(localEndpoints)
          const current = localNodeNotListed && (await this.dal.getCurrentBlockOrNull());
          if (localNodeNotListed && (!current || current.number > blockNumber)) {
            // Document with pubkey of local peer, but doesn't contain local interface: we must add it
            this.generateSelfPeer(this.conf);
          } else {
            this.peerInstance = peerEntity;
          }
        }
        return PeerDTO.fromDBPeer(savedPeer)
      } catch (e) {
        throw e
      }
    })
  }

  handleNewerPeer(pretendedNewer:DBPeer) {
    logger.debug('Applying pretended newer peer document %s/%s', pretendedNewer.block);
    return this.server.writePeer(pretendedNewer)
  }

  async generateSelfPeer(theConf:ConfDTO, signalTimeInterval = 0) {
    const current = await this.server.dal.getCurrentBlockOrNull();
    const currency = theConf.currency || constants.DEFAULT_CURRENCY_NAME;
    const peers = await this.dal.findPeers(this.selfPubkey);
    let p1 = {
      version: constants.DOCUMENTS_VERSION,
      currency: currency,
      block: '0-E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
      endpoints: []
    };
    const currentSelfPeer = peers[0]
    if (peers.length != 0 && currentSelfPeer) {
      p1 = _(currentSelfPeer).extend({version: constants.DOCUMENTS_VERSION, currency: currency});
    }
    const localEndpoints = await this.server.getEndpoints()
    const otherPotentialEndpoints = this.getOtherEndpoints(p1.endpoints, localEndpoints)
    logger.info('Sibling endpoints:', otherPotentialEndpoints);
    const wrongEndpoints = await this.server.getWrongEndpoints(otherPotentialEndpoints)
    for (const wrong of wrongEndpoints) {
      logger.warn('Wrong endpoint \'%s\'', wrong)
    }
    const toRemoveByConf = (this.conf.rmEndpoints || [])
    let toConserve = otherPotentialEndpoints.filter(ep => wrongEndpoints.indexOf(ep) === -1 && toRemoveByConf.indexOf(ep) === -1)
    if (!currency) {
      logger.error('It seems there is an issue with your configuration.');
      logger.error('Please restart your node with:');
      logger.error('$ duniter restart');
      return new Promise(() => null);
    }
    const endpointsToDeclare = localEndpoints.concat(toConserve).concat(this.conf.endpoints || [])
    if (currentSelfPeer && endpointsToDeclare.length === 0 && currentSelfPeer.endpoints.length === 0) {
      /*********************
       * Conserver peer document
       *********************/
      return currentSelfPeer
    } else {
      /*********************
       * Renew peer document
       *********************/
      // Choosing next based-block for our peer record: we basically want the most distant possible from current
      let minBlock = current ? current.number - 30 : 0;
      if (p1) {
        // But if already have a peer record within this distance, we need to take the next block of it
        minBlock = Math.max(minBlock, parseInt(p1.block.split('-')[0], 10) + 1);
      }
      // The number cannot be superior to current block
      minBlock = Math.min(minBlock, current ? current.number : minBlock);
      let targetBlock = await this.server.dal.getBlock(minBlock);
      const p2:any = {
        version: constants.DOCUMENTS_VERSION,
        currency: currency,
        pubkey: this.selfPubkey,
        block: targetBlock ? [targetBlock.number, targetBlock.hash].join('-') : constants.PEER.SPECIAL_BLOCK,
        endpoints: _.uniq(endpointsToDeclare)
      };
      const raw2 = dos2unix(PeerDTO.fromJSONObject(p2).getRaw());
      const bmaAccess = PeerDTO.fromJSONObject(p2).getURL()
      if (bmaAccess) {
        logger.info('BMA access:', bmaAccess)
      }
      logger.debug('Generating server\'s peering entry based on block#%s...', p2.block.split('-')[0]);
      p2.signature = await this.server.sign(raw2);
      p2.pubkey = this.selfPubkey;
      // Remember this is now local peer value
      this.peerInstance = p2;
      try {
        // Submit & share with the network
        await this.server.writePeer(p2)
      } catch (e) {
        logger.error(e)
      }
      const selfPeer = await this.dal.getPeer(this.selfPubkey);
      // Set peer's statut to UP
      await this.peer(selfPeer);
      this.server.streamPush(selfPeer);
      if (signalTimeInterval) {
        logger.info("Next peering signal in %s min", signalTimeInterval / 1000 / 60)
      }
      return selfPeer
    }
  }

  private getOtherEndpoints(endpoints:string[], localEndpoints:string[]) {
    return endpoints.filter((ep) => localEndpoints.indexOf(ep) === -1)
  }
}

util.inherits(PeeringService, events.EventEmitter);
