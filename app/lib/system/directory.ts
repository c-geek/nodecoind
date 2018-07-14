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

import * as path from "path"
import * as fs from 'fs'
import {SQLiteDriver} from "../dal/drivers/SQLiteDriver"
import {CFSCore} from "../dal/fileDALs/CFSCore"
import {WoTBInstance, WoTBObject} from "../wot"
import {FileDALParams} from "../dal/fileDAL"
import {LokiJsDriver} from "../dal/drivers/LokiJsDriver"
import {cliprogram} from "../common-libs/programOptions"

const opts = cliprogram
const qfs  = require('q-io/fs');

const DEFAULT_DOMAIN = "duniter_default";
const DEFAULT_HOME = (process.platform == 'win32' ? process.env.USERPROFILE : process.env.HOME) + '/.config/duniter/';

const getLogsPath = (profile:string|undefined, directory:string|null = null) => path.join(getHomePath(profile, directory), 'duniter.log');

const getHomePath = (profile:string|null|undefined, directory:string|null = null) => path.normalize(getUserHome(directory) + '/') + getDomain(profile);

const getUserHome = (directory:string|null = null) => (directory || DEFAULT_HOME);

const getDomain = (profile:string|null = null) => (profile || DEFAULT_DOMAIN);

export interface FileSystem {
  fsExists(file:string): Promise<boolean>
  fsReadFile(file:string): Promise<string>
  fsUnlink(file:string): Promise<boolean>
  fsList(dir:string): Promise<string[]>
  fsWrite(file:string, content:string): Promise<void>
  fsMakeDirectory(dir:string): Promise<void>
  fsRemoveTree(dir:string): Promise<void>
  fsStreamTo(file: string, iterator: IterableIterator<string>): Promise<void>
}

class QioFileSystem implements FileSystem {

  constructor(private qio:any, private isMemory:boolean = false) {}

  async fsExists(file:string) {
    return this.qio.exists(file)
  }

  async fsReadFile(file:string) {
    return this.qio.read(file)
  }

  async fsUnlink(file:string) {
    return this.qio.remove(file)
  }

  async fsList(dir: string): Promise<string[]> {
    if (!(await this.qio.exists(dir))) {
      return []
    }
    return this.qio.list(dir)
  }

  fsWrite(file: string, content: string): Promise<void> {
    return this.qio.write(file, content)
  }

  async fsStreamTo(file: string, iterator: IterableIterator<string>): Promise<void> {
    if (this.isMemory) {
      for (const line of iterator) {
        await this.qio.append(file, line)
      }
    } else {
      // Use NodeJS streams for faster writing
      let wstream = fs.createWriteStream(file)
      await new Promise(async (res, rej) => {
        // When done, return
        wstream.on('close', (err:any) => {
          if (err) return rej(err)
          res()
        })
        // Write each line
        for (const line of iterator) {
          wstream.write(line + "\n")
        }
        // End the writing
        wstream.end()
      })
    }
  }

  fsMakeDirectory(dir: string): Promise<void> {
    return this.qio.makeTree(dir)
  }

  async fsRemoveTree(dir: string): Promise<void> {
    return this.qio.removeTree(dir)
  }
}

export const RealFS = (): FileSystem => {
  return new QioFileSystem(qfs)
}

export const MemFS = (initialTree:{ [folder:string]: { [file:string]: string }} = {}): FileSystem => {
  return new QioFileSystem(require('q-io/fs-mock')(initialTree), true)
}

export const Directory = {

  INSTANCE_NAME: getDomain(opts.mdb),
  INSTANCE_HOME: getHomePath(opts.mdb, opts.home),
  INSTANCE_HOMELOG_FILE: getLogsPath(opts.mdb, opts.home),
  DUNITER_DB_NAME: 'duniter',
  LOKI_DB_DIR: 'loki',
  WOTB_FILE: 'wotb.bin',

  getHome: (profile:string|null = null, directory:string|null = null) => getHomePath(profile, directory),

  getHomeFS: async (isMemory:boolean, theHome:string, makeTree = true) => {
    const home = theHome || Directory.getHome()
    const params = {
      home: home,
      fs: isMemory ? MemFS() : RealFS()
    }
    if (makeTree) {
      await params.fs.fsMakeDirectory(home)
    }
    return params;
  },

  getHomeParams: async (isMemory:boolean, theHome:string): Promise<FileDALParams> => {
    const params = await Directory.getHomeFS(isMemory, theHome)
    const home = params.home;
    let dbf: () => SQLiteDriver
    let dbf2: () => LokiJsDriver
    let wotb: WoTBInstance
    if (isMemory) {

      // Memory DB
      dbf = () => new SQLiteDriver(':memory:');
      dbf2 = () => new LokiJsDriver()
      wotb = WoTBObject.memoryInstance();

    } else {

      // File DB
      const sqlitePath = path.join(home, Directory.DUNITER_DB_NAME + '.db');
      dbf = () => new SQLiteDriver(sqlitePath);
      const wotbFilePath = path.join(home, Directory.WOTB_FILE);
      let existsFile = await qfs.exists(wotbFilePath)
      if (!existsFile) {
        fs.closeSync(fs.openSync(wotbFilePath, 'w'));
      }
      dbf2 = () => new LokiJsDriver(path.join(home, Directory.LOKI_DB_DIR))
      wotb = WoTBObject.fileInstance(wotbFilePath);
    }
    return {
      home: params.home,
      fs: params.fs,
      dbf,
      dbf2,
      wotb
    }
  },

  createHomeIfNotExists: async (fileSystem:any, theHome:string) => {
    const fsHandler = new CFSCore(theHome, fileSystem);
    return fsHandler.makeTree('');
  }
}
