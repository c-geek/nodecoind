import {LokiIndex} from "./LokiIndex"
import {NewLogger} from "../../../logger"
import {BlockchainDAO} from "../abstract/BlockchainDAO"
import {DBBlock} from "../../../db/DBBlock"
import {getMicrosecondsTime} from "../../../../ProcessCpuProfiler"

const logger = NewLogger()

export class LokiBlockchain extends LokiIndex<DBBlock> implements BlockchainDAO {

  private current:DBBlock|null = null

  constructor(loki:any) {
    super(loki, 'blockchain', ['number', 'hash', 'fork'])
  }

  async getCurrent() {
    if (this.current) {
      // Cached
      return this.current
    } else {
      // Costly method, as a fallback
      return this.collection
        .chain()
        .find({
          fork: false
        })
        .simplesort('number', true)
        .data()[0]
    }
  }

  async getBlock(number:string | number) {
    const now = getMicrosecondsTime()
    const b = this.collection
      .chain()
      .find({
        number: parseInt(String(number)),
        fork: false
      })
      .data()[0]
    logger.trace('[loki][%s][getBlock] %sµs', this.collectionName, (getMicrosecondsTime() - now), number)
    return b
  }

  async getPotentialRoots() {
    return this.collection
      .chain()
      .find({ number: 0, fork: true })
      .data()
  }

  async saveBunch(blocks:DBBlock[]) {
    return this.insertBatch(blocks)
  }

  async insert(record: DBBlock): Promise<void> {
    this.current = record
    return super.insert(record);
  }

  async removeBlock(blockstamp: string): Promise<void> {
    // Never remove blocks
  }

  async getAbsoluteBlock(number: number, hash: string): Promise<DBBlock | null> {
    return this.collection
      .chain()
      .find({
        number,
        hash
      })
      .data()[0]
  }

  async getBlocks(start: number, end: number): Promise<DBBlock[]> {
    return this.collection
      .chain()
      .find({
        number: { $between: [start, end] },
        fork: false
      })
      .simplesort('number')
      .data()
  }

  async getCountOfBlocksIssuedBy(issuer: string): Promise<number> {
    return this.collection
      .chain()
      .find({
        issuer,
        fork: false
      })
      .data()
      .length
  }

  async getNextForkBlocks(number: number, hash: string): Promise<DBBlock[]> {
    return this.collection
      .chain()
      .find({
        fork: true,
        number: number + 1,
        previousHash: hash
      })
      .simplesort('number')
      .data()
  }

  async getPotentialForkBlocks(numberStart: number, medianTimeStart: number, maxNumber: number): Promise<DBBlock[]> {
    return this.collection
      .chain()
      .find({
        fork: true,
        number: { $between: [numberStart, maxNumber] },
        medianTime: { $gt: medianTimeStart }
      })
      .simplesort('number')
      .data()
  }

  async lastBlockOfIssuer(issuer: string): Promise<DBBlock | null> {
    return this.collection
      .chain()
      .find({
        fork: false,
        issuer
      })
      .simplesort('number', true)
      .data()[0]
  }

  async saveBlock(block: DBBlock): Promise<DBBlock> {
    block.fork = false
    await this.insert(block)
    if (!this.current || this.current.number < block.number) {
      this.current = block
    }
    return block
  }

  async saveSideBlock(block: DBBlock): Promise<DBBlock> {
    block.fork = true
    await this.insert(block)
    return block
  }

  async dropNonForkBlocksAbove(number: number): Promise<void> {
    this.collection
      .chain()
      .find({
        fork: false,
        number: { $gt: number }
      })
      .remove()
  }

  async setSideBlock(number: number, previousBlock: DBBlock | null): Promise<void> {
    this.collection
      .chain()
      .find({
        number
      })
      .update((b:DBBlock) => {
        b.fork = true
      })
  }

}