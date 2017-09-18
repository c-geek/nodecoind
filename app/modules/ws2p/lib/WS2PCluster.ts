import {WS2PServer} from "./WS2PServer"
import {Server} from "../../../../server"
import {WS2PClient} from "./WS2PClient"
import {WS2PConnection} from "./WS2PConnection"
import {randomPick} from "../../../lib/common-libs/randomPick"
import {CrawlerConstants} from "../../crawler/lib/constants"
import {WS2PBlockPuller} from "./WS2PBlockPuller"
import {WS2PDocpoolPuller} from "./WS2PDocpoolPuller"
import {WS2PConstants} from "./constants"
import {PeerDTO} from "../../../lib/dto/PeerDTO"
import {GlobalFifoPromise} from "../../../service/GlobalFifoPromise"
import {OtherConstants} from "../../../lib/other_constants"
import {Key, verify} from "../../../lib/common-libs/crypto/keyring"
import {WS2PServerMessageHandler} from "./interface/WS2PServerMessageHandler"
import {WS2PMessageHandler} from "./impl/WS2PMessageHandler"

const es = require('event-stream')
const nuuid = require('node-uuid')
const _ = require('underscore')

export interface WS2PHead {
  message:string
  sig:string
}

export class WS2PCluster {

  private ws2pServer:WS2PServer|null = null
  private ws2pClients:{[k:string]:WS2PClient} = {}
  private host:string|null = null
  private port:number|null = null
  private syncBlockInterval:NodeJS.Timer
  private syncDocpoolInterval:NodeJS.Timer
  private fifo:GlobalFifoPromise = new GlobalFifoPromise()
  private maxLevel1Size = WS2PConstants.MAX_LEVEL_1_PEERS
  private messageHandler: WS2PServerMessageHandler

  // A cache to know if a block exists or not in the DB
  private blockstampsCache:{ [k:string]: number } = {}

  // A cache to know wether a pubkey is a member or not
  private memberkeysCache:{ [k:string]: number } = {}

  // A cache of the current HEAD for a given pubkey
  private headsCache:{ [pubkey:string]: { blockstamp:string, message:string, sig:string } } = {}

  // A buffer of "to be sent" heads
  private newHeads:{ message:string, sig:string }[] = []

  // The triggerer of a buffer of heads' sending
  private headsTimeout:NodeJS.Timer|null = null

  private constructor(private server:Server) {
    this.messageHandler = new WS2PServerMessageHandler(this.server, this)
  }

  async getKnownHeads(): Promise<WS2PHead[]> {
    const heads:WS2PHead[] = []
    const localPub = this.server.conf.pair.pub
    if (!this.headsCache[localPub]) {
      const current = await this.server.dal.getCurrentBlockOrNull()
      if (current) {
        const { sig, message } = this.sayHeadChangedTo(current.number, current.hash)
        const blockstamp = [current.number, current.hash].join('-')
        this.headsCache[localPub] = { blockstamp, message, sig }
      }
    }
    for (const pubkey of Object.keys(this.headsCache)) {
      heads.push({
        message: this.headsCache[pubkey].message,
        sig: this.headsCache[pubkey].sig
      })
    }
    return heads
  }

  async headsReceived(heads:[{ message:string, sig:string }]) {
    const added:{ message:string, sig:string }[] = []
    await Promise.all(heads.map(async (h:{ message:string, sig:string }) => {
      const message = h.message
      const sig = h.sig
      try {
        if (message && message.match(WS2PConstants.HEAD_REGEXP)) {
          const [,, pub, blockstamp]:string[] = message.split(':')
          const sigOK = verify(message, sig, pub)
          if (sigOK) {
            // Already known?
            if (!this.headsCache[pub] || this.headsCache[pub].blockstamp !== blockstamp) {
              // More recent?
              if (!this.headsCache[pub] || parseInt(this.headsCache[pub].blockstamp) < parseInt(blockstamp)) {
                // Check that issuer is a member and that the block exists
                const memberKey = await this.isMemberKey(pub)
                if (memberKey) {
                  const exists = await this.existsBlock(blockstamp)
                  if (exists) {
                    this.headsCache[pub] = { blockstamp, message, sig }
                    this.newHeads.push({message, sig})
                    added.push({message, sig})
                    // Cancel a pending "heads" to be spread
                    if (this.headsTimeout) {
                      clearTimeout(this.headsTimeout)
                    }
                    // Reprogram it a few moments later
                    this.headsTimeout = setTimeout(async () => {
                      const heads = this.newHeads.splice(0, this.newHeads.length)
                      if (heads.length) {
                        await this.spreadNewHeads(heads)
                      }
                    }, WS2PConstants.HEADS_SPREAD_TIMEOUT)
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        this.server.logger.trace('Rejected message %s:', message, e)
      }
    }))
    this.server.push({
      ws2p: 'heads',
      added
    })
    return added
  }

  private async isMemberKey(pub:string) {
    let isMember = false
    if (this.memberkeysCache[pub]) {
      isMember = true
    }
    if (!isMember) {
      // Do we have this block in the DB?
      isMember = !!(await this.server.dal.isMember(pub))
    }
    // Update the last time it was checked
    this.memberkeysCache[pub] = Date.now()
    return isMember
  }

  private async existsBlock(blockstamp:string) {
    let exists = false
    if (this.blockstampsCache[blockstamp]) {
      exists = true
    }
    if (!exists) {
      // Do we have this block in the DB?
      exists = !!(await this.server.dal.getAbsoluteBlockByBlockstamp(blockstamp))
    }
    // Update the last time it was checked
    this.blockstampsCache[blockstamp] = Date.now()
    return exists
  }

  static plugOn(server:Server) {
    const cluster = new WS2PCluster(server)
    server.ws2pCluster = cluster
    return cluster
  }

  set maxLevel1Peers(newValue:number) {
    this.maxLevel1Size = Math.max(newValue, 0) || 0
  }

  set maxLevel2Peers(newValue:number) {
    if (this.ws2pServer) {
      this.ws2pServer.maxLevel2Peers = Math.max(newValue, 0)
    }
  }

  get maxLevel2Peers() {
    if (this.ws2pServer) {
      return this.ws2pServer.maxLevel2Peers || 0
    }
    return 0
  }

  async listen(host:string, port:number) {
    if (this.ws2pServer) {
      await this.ws2pServer.close()
    }
    this.ws2pServer = await WS2PServer.bindOn(this.server, host, port, this.fifo, (pubkey:string, connectedPubkeys:string[]) => {
      return this.acceptPubkey(pubkey, connectedPubkeys, () => this.servedCount(), this.maxLevel2Peers, (this.server.conf.ws2p && this.server.conf.ws2p.alwaysAccept || []))
    }, this.messageHandler)
    this.host = host
    this.port = port
    return this.ws2pServer
  }

  async close() {
    if (this.ws2pServer) {
      await this.ws2pServer.close()
    }
    const connections = await this.getAllConnections()
    await Promise.all(connections.map(c => c.close()))
  }

  clientsCount() {
    return Object.keys(this.ws2pClients).length
  }

  servedCount() {
    return this.ws2pServer ? this.ws2pServer.getConnexions().length : 0
  }

  async connect(host: string, port: number, messageHandler:WS2PMessageHandler): Promise<WS2PConnection> {
    const uuid = nuuid.v4()
    let pub = "--------"
    try {
      const ws2pc = await WS2PClient.connectTo(this.server, host, port, messageHandler)
      this.ws2pClients[uuid] = ws2pc
      pub = ws2pc.connection.pubkey
      ws2pc.connection.closed.then(() => {
        this.server.logger.info('WS2P: connection [%s `WS2P %s %s`] has been closed', pub.slice(0, 8), host, port)
        this.server.push({
          ws2p: 'disconnected',
          peer: {
            pub: ws2pc.connection.pubkey
          }
        })
        if (this.ws2pClients[uuid]) {
          delete this.ws2pClients[uuid]
        }
      })
      this.server.logger.info('WS2P: connected to peer %s using `WS2P %s %s`!', pub.slice(0, 8), host, port)
      this.server.push({
        ws2p: 'connected',
        to: { host, port, pubkey: pub }
      })
      return ws2pc.connection
    } catch (e) {
      this.server.logger.info('WS2P: Could not connect to peer %s using `WS2P %s %s: %s`', pub.slice(0, 8), host, port, (e && e.message || e))
      throw e
    }
  }

  async connectToWS2Peers() {
    const potentials = await this.server.dal.getWS2Peers()
    const peers:PeerDTO[] = potentials.map((p:any) => PeerDTO.fromJSONObject(p))
    let i = 0
    while (i < peers.length && this.clientsCount() < this.maxLevel1Size) {
      const p = peers[i]
      const api = p.getWS2P()
      if (p.pubkey !== this.server.conf.pair.pub) {
        try {
          await this.connect(api.host, api.port, this.messageHandler)
        } catch (e) {
          this.server.logger.debug('WS2P: init: failed connection')
        }
      }
      i++
    }

    // Also listen for network updates, and connect to new nodes
    this.server.pipe(es.mapSync((data:any) => {

      (async () => {
        // New peer
        if (data.endpoints) {
          const peer = PeerDTO.fromJSONObject(data)
          const ws2pEnpoint = peer.getWS2P()
          if (ws2pEnpoint && peer.pubkey !== this.server.conf.pair.pub) {
            // Check if already connected to the pubkey (in any way: server or client)
            const connectedPubkeys = this.getConnectedPubkeys()
            const shouldAccept = await this.acceptPubkey(peer.pubkey, connectedPubkeys, () => this.clientsCount(), this.maxLevel1Size, (this.server.conf.ws2p && this.server.conf.ws2p.preferedNodes || []))
            if (shouldAccept) {
              await this.connect(ws2pEnpoint.host, ws2pEnpoint.port, this.messageHandler)
              // Trim the eventual extra connections
              await this.trimClientConnections()
            }
          }
        }

        // Block received
        else if (data.joiners) {
          // Update the cache
          this.blockstampsCache[[data.number, data.hash].join('-')] = Date.now()
        }

        // HEAD changed
        else if (data.bcEvent === OtherConstants.BC_EVENT.HEAD_CHANGED || data.bcEvent === OtherConstants.BC_EVENT.SWITCHED) {
          // Propagate this change to the network
          const { sig, message } = this.sayHeadChangedTo(data.block.number, data.block.hash)
          try {
            await this.broadcastHead(message, sig)
          } catch (e) {
            this.server.logger.warn(e)
          }
        }
      })()

      return data
    }))
  }

  private async broadcastHead(message:string, sig:string) {
    await this.headsReceived([{ message, sig }])
    return this.spreadNewHeads([{ message, sig }])
  }

  private async spreadNewHeads(heads:{ message:string, sig:string }[]) {
    const connexions = await this.getAllConnections()
    return Promise.all(connexions.map(async (c) => {
      try {
        await c.pushHeads(heads)
      } catch (e) {
        this.server.logger.warn('Could not spread new HEAD info to %s WS2P %s %s', c.pubkey)
      }
    }))
  }

  private sayHeadChangedTo(number:number, hash:string) {
    const key = new Key(this.server.conf.pair.pub, this.server.conf.pair.sec)
    const pub = key.publicKey
    const message = `WS2P:HEAD:${pub}:${number}-${hash}`
    const sig = key.signSync(message)
    return { sig, message, pub }
  }

  async trimClientConnections() {
    let disconnectedOne = true
    // Disconnect non-members
    while (disconnectedOne && this.clientsCount() > this.maxLevel1Size) {
      disconnectedOne = false
      let uuids = Object.keys(this.ws2pClients)
      uuids = _.shuffle(uuids)
      for (const uuid of uuids) {
        const client = this.ws2pClients[uuid]
        const isMember = await this.server.dal.isMember(client.connection.pubkey)
        if (!isMember && !disconnectedOne) {
          client.connection.close()
          await client.connection.closed
          disconnectedOne = true
        }
      }
    }
    disconnectedOne = true
    // Disconnect non-prefered members
    while (disconnectedOne && this.clientsCount() > this.maxLevel1Size) {
      disconnectedOne = false
      let uuids = Object.keys(this.ws2pClients)
      uuids = _.shuffle(uuids)
      for (const uuid of uuids) {
        const client = this.ws2pClients[uuid]
        if (!disconnectedOne && this.getPreferedNodes().indexOf(client.connection.pubkey) === -1) {
          client.connection.close()
          disconnectedOne = true
          await client.connection.closed
          if (this.ws2pClients[uuid]) {
            delete this.ws2pClients[uuid]
          }
        }
      }
    }
    // Disconnect anything
    disconnectedOne = true
    while (disconnectedOne && this.clientsCount() > this.maxLevel1Size) {
      disconnectedOne = false
      let uuids = Object.keys(this.ws2pClients)
      uuids = _.shuffle(uuids)
      for (const uuid of uuids) {
        const client = this.ws2pClients[uuid]
        if (!disconnectedOne) {
          client.connection.close()
          disconnectedOne = true
          await client.connection.closed
          if (this.ws2pClients[uuid]) {
            delete this.ws2pClients[uuid]
          }
        }
      }
    }
  }

  private getPreferedNodes(): string[] {
    return (this.server.conf.ws2p && this.server.conf.ws2p.preferedNodes) || []
  }

  protected async acceptPubkey(
    pub:string,
    connectedPubkeys:string[],
    getConcurrentConnexionsCount:()=>number,
    maxConcurrentConnexionsSize:number,
    priorityKeys:string[]
  ) {
    let accept = priorityKeys.indexOf(pub) !== -1
    if (!accept && connectedPubkeys.indexOf(pub) === -1) {
      // Do we have room?
      if (getConcurrentConnexionsCount() < maxConcurrentConnexionsSize) {
        // Yes: just connect to it
        accept = true
      }
      else {
        // No:
        // Does this node have the priority over at least one node?
        const isMemberPeer = await this.server.dal.isMember(pub)
        if (isMemberPeer) {
          // The node may have the priority over at least 1 other node
          let i = 0, existsOneNonMemberNode = false
          while (!existsOneNonMemberNode && i < connectedPubkeys.length) {
            const isAlsoAMemberPeer = await this.server.dal.isMember(connectedPubkeys[i])
            existsOneNonMemberNode = !isAlsoAMemberPeer
            i++
          }
          if (existsOneNonMemberNode) {
            // The node has the priority over a non-member peer: try to connect
            accept = true
          }
        }
      }
    }
    return accept
  }

  async getLevel1Connections() {
    const all:WS2PConnection[] = []
    for (const uuid of Object.keys(this.ws2pClients)) {
      all.push(this.ws2pClients[uuid].connection)
    }
    return all
  }

  async getLevel2Connections(): Promise<WS2PConnection[]> {
    return this.ws2pServer ? this.ws2pServer.getConnexions() : []
  }

  async getAllConnections() {
    const all:WS2PConnection[] = this.ws2pServer ? this.ws2pServer.getConnexions() : []
    for (const uuid of Object.keys(this.ws2pClients)) {
      all.push(this.ws2pClients[uuid].connection)
    }
    return all
  }

  async startCrawling() {
    // For blocks
    if (this.syncBlockInterval)
      clearInterval(this.syncBlockInterval);
    this.syncBlockInterval = setInterval(() => this.pullBlocks(), 1000 * WS2PConstants.BLOCK_PULLING_INTERVAL)
    // Pull blocks right on start
    await this.connectToWS2Peers()
    await this.pullBlocks()
    // For docpool
    if (this.syncDocpoolInterval)
      clearInterval(this.syncDocpoolInterval);
    this.syncDocpoolInterval = setInterval(() => this.pullDocpool(), 1000 * WS2PConstants.DOCPOOL_PULLING_INTERVAL)
    // The first pulling occurs 10 minutes after the start
    setTimeout(() => this.pullDocpool(), WS2PConstants.SANDBOX_FIRST_PULL_DELAY)
  }

  async stopCrawling() {
    if (this.syncBlockInterval) {
      clearInterval(this.syncBlockInterval)
    }
    if (this.syncDocpoolInterval) {
      clearInterval(this.syncDocpoolInterval)
    }
  }

  async pullBlocks() {
    let current:{number:number} = { number: -1 }
    let newCurrent:{number:number} = { number: 0 }
    while (current && newCurrent && newCurrent.number > current.number) {
      current = newCurrent
      await this.makeApullShot()
      newCurrent = await this.server.dal.getCurrentBlockOrNull()
    }
    if (current) {
      this.server.pullingEvent('end', current.number)
    }
  }

  private async makeApullShot() {
    const connections = await this.getAllConnections()
    const chosen = randomPick(connections, CrawlerConstants.CRAWL_PEERS_COUNT)

    await Promise.all(chosen.map(async (conn) => {
      try {
        const puller = new WS2PBlockPuller(this.server, conn)
        await puller.pull()
      } catch (e) {
        this.server.logger.warn(e)
      }
    }))

    await this.server.BlockchainService.pushFIFO("WS2PCrawlerResolution", async () => {
      await this.server.BlockchainService.blockResolution()
      await this.server.BlockchainService.forkResolution()
    })
  }

  async pullDocpool() {
    const connections = await this.getAllConnections()
    const chosen = randomPick(connections, CrawlerConstants.CRAWL_PEERS_COUNT)
    await Promise.all(chosen.map(async (conn) => {
      const puller = new WS2PDocpoolPuller(this.server, conn)
      await puller.pull()
    }))
  }

  getConnectedPubkeys() {
    const clients = Object.keys(this.ws2pClients).map(k => this.ws2pClients[k].connection.pubkey)
    const served = this.ws2pServer ? this.ws2pServer.getConnexions().map(c => c.pubkey) : []
    return clients.concat(served)
  }
}