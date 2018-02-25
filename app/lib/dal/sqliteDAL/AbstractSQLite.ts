import {SQLiteDriver} from "../drivers/SQLiteDriver"
/**
 * Created by cgeek on 22/08/15.
 */

const _ = require('underscore');
const co = require('co');
const colors = require('colors');
const logger = require('../../logger').NewLogger('sqlite');

export interface BeforeSaveHook<T> {
  (t:T): void
}

export abstract class AbstractSQLite<T> {

  constructor(
    private driver:SQLiteDriver,
    public readonly table: string,
    private pkFields: string[] = [],
    protected fields: string[] = [],
    private arrays: string[] = [],
    private booleans: string[] = [],
    private bigintegers: string[] = [],
    private transientFields: string[] = [],
    private beforeSaveHook: BeforeSaveHook<T> | null = null
  ) {
  }

  async query(sql:string, params: any[] = []): Promise<T[]> {
    try {
      //logger.trace(sql, JSON.stringify(params || []));
      const start = Date.now()
      const res = await this.driver.executeAll(sql, params || []);
      const duration = Date.now() - start;
      const entities = res.map((t:T) => this.toEntity(t))
      // Display result
      let msg = sql + ' | %s\t==> %s rows in %s ms';
      if (duration <= 2) {
        msg = colors.green(msg);
      } else if(duration <= 5) {
        msg = colors.yellow(msg);
      } else if (duration <= 10) {
        msg = colors.magenta(msg);
      } else if (duration <= 100) {
        msg = colors.red(msg);
      }
      logger.query(msg, JSON.stringify(params || []), entities.length, duration);
      return entities;
    } catch (e) {
      logger.error('ERROR >> %s', sql, JSON.stringify(params || []), e.stack || e.message || e);
      throw e;
    }
  }

  cleanData(): Promise<void> {
    return this.exec("DELETE FROM " + this.table)
  }

  sqlListAll(): Promise<T[]> {
    return this.query("SELECT * FROM " + this.table)
  }

  sqlDeleteAll() {
    return this.cleanData()
  }

  sqlFind(obj:any, sortObj:any = {}): Promise<T[]> {
    const conditions = this.toConditionsArray(obj).join(' and ');
    const values = this.toParams(obj);
    const sortKeys: string[] = _.keys(sortObj);
    const sort = sortKeys.length ? ' ORDER BY ' + sortKeys.map((k) => "`" + k + "` " + (sortObj[k] ? 'DESC' : 'ASC')).join(',') : '';
    return this.query('SELECT * FROM ' + this.table + ' WHERE ' + conditions + sort, values);
  }

  async sqlFindOne(obj:any, sortObj:any = null): Promise<T> {
    const res = await this.sqlFind(obj, sortObj)
    return res[0]
  }

  sqlFindLikeAny(obj:any): Promise<T[]> {
    const keys:string[] = _.keys(obj);
    return this.query('SELECT * FROM ' + this.table + ' WHERE ' + keys.map((k) => 'UPPER(`' + k + '`) like ?').join(' or '), keys.map((k) => obj[k].toUpperCase()))
  }

  async sqlRemoveWhere(obj:any): Promise<void> {
    const keys:string[] = _.keys(obj);
    await this.query('DELETE FROM ' + this.table + ' WHERE ' + keys.map((k) => '`' + k + '` = ?').join(' and '), keys.map((k) => obj[k]))
  }

  sqlExisting(entity:T): Promise<T> {
    return this.getEntity(entity)
  }

  async saveEntity(entity:any): Promise<void> {
    let toSave:any = entity;
    if (this.beforeSaveHook) {
      this.beforeSaveHook(toSave);
    }
    const existing = await this.getEntity(toSave);
    if (existing) {
      toSave = this.toRow(toSave);
      const valorizations = this.fields.map((field) => '`' + field + '` = ?').join(', ');
      const conditions = this.getPKFields().map((field) => '`' + field + '` = ?').join(' and ');
      const setValues = this.fields.map((field) => toSave[field]);
      const condValues = this.getPKFields().map((k) => toSave[k]);
      await this.query('UPDATE ' + this.table + ' SET ' + valorizations + ' WHERE ' + conditions, setValues.concat(condValues));
      return
    }
    await this.insert(toSave);
  }

  async insert(entity:T): Promise<void> {
    const row = this.toRow(entity);
    const values = this.fields.map((f) => row[f]);
    await this.query(this.getInsertQuery(), values)
  }

  async getEntity(entity:any): Promise<T> {
    const conditions = this.getPKFields().map((field) => '`' + field + '` = ?').join(' and ');
    const params = this.toParams(entity, this.getPKFields());
    return (await this.query('SELECT * FROM ' + this.table + ' WHERE ' + conditions, params))[0];
  }

  async deleteEntity(entity:any): Promise<void> {
    const toSave = this.toRow(entity);
    if (this.beforeSaveHook) {
      this.beforeSaveHook(toSave);
    }
    const conditions = this.getPKFields().map((field) => '`' + field + '` = ?').join(' and ');
    const condValues = this.getPKFields().map((k) => toSave[k]);
    await this.query('DELETE FROM ' + this.table + ' WHERE ' + conditions, condValues)
  }

  exec(sql:string): Promise<void> {
    try {
      //console.warn(sql);
      return this.driver.executeSql(sql);
    } catch (e) {
      //console.error('ERROR >> %s', sql);
      throw e;
    }
  }

  getInsertQuery(): string {
    return "INSERT INTO " + this.table + " (" + this.fields.map(f => '`' + f + '`').join(',') + ") VALUES (" + "?,".repeat(this.fields.length - 1) + "?);"
  }

  getInsertHead(): string {
    const valuesKeys = this.fields
    return 'INSERT INTO ' + this.table + " (" + valuesKeys.map(f => '`' + f + '`').join(',') + ") VALUES ";
  }

  getInsertValue(toSave:T): string {
    if (this.beforeSaveHook) {
      this.beforeSaveHook(toSave);
    }
    const row = this.toRow(toSave);
    const valuesKeys = this.fields
    const values = valuesKeys.map((field) => this.escapeToSQLite(row[field]));
    return "(" + values.join(',') + ")";
  }

  toInsertValues(entity:T): string {
    const row = this.toRow(entity);
    const values = this.fields.map((f) => row[f]);
    const formatted = values.map((s:string) => this.escapeToSQLite(s))
    return "(" + formatted.join(',') + ")";
  }

  /**
   * Make a batch insert.
   * @param records The records to insert as a batch.
   */
  async insertBatch(records:T[]): Promise<void> {
    const queries = [];
    if (records.length) {
      const insert = this.getInsertHead();
      const values = records.map((src) => this.getInsertValue(src));
      queries.push(insert + '\n' + values.join(',\n') + ';');
    }
    if (queries.length) {
      await this.exec(queries.join('\n'))
    }
  }

  private toConditionsArray(obj:any): string[] {
    return _.keys(obj).map((k:string) => {
      if (obj[k].$lte !== undefined) {
        return '`' + k + '` <= ?';
      } else if (obj[k].$gte !== undefined) {
        return '`' + k + '` >= ?';
      } else if (obj[k].$gt !== undefined) {
        return '`' + k + '` > ?';
      }  else if (obj[k].$lt !== undefined) {
        return '`' + k + '` < ?';
      }  else if (obj[k].$null !== undefined) {
        return '`' + k + '` IS ' + (!obj[k].$null ? 'NOT' : '') + ' NULL';
      }  else if (obj[k].$contains !== undefined) {
        return '`' + k + '` LIKE ?';
      } else {
        return '`' + k + '` = ?';
      }
    });
  }

  private toParams(obj:any, fields:string[] | null = null): any[] {
    let params:any[] = [];
    (fields || _.keys(obj)).forEach((f:string) => {
      if (obj[f].$null === undefined) {
        let pValue;
        if      (obj[f].$lte  !== undefined)      { pValue = obj[f].$lte;  }
        else if (obj[f].$gte  !== undefined)      { pValue = obj[f].$gte;  }
        else if (obj[f].$gt   !== undefined)      { pValue = obj[f].$gt;   }
        else if (obj[f].$lt   !== undefined)      { pValue = obj[f].$lt;   }
        else if (obj[f].$null !== undefined)      { pValue = obj[f].$null; }
        else if (obj[f].$contains !== undefined) { pValue = "%" + obj[f].$contains + "%"; }
        else if (~this.bigintegers.indexOf(f) && typeof obj[f] !== "string") {
          pValue = String(obj[f]);
        } else {
          pValue = obj[f];
        }
        params.push(pValue);
      }
    });
    return params;
  }

  private escapeToSQLite(val:string): any {
    if (typeof val == "boolean") {
      // SQLite specific: true => 1, false => 0
      if (val !== null && val !== undefined) {
        return val ? 1 : 0;
      } else {
        return null;
      }
    }
    else if (typeof val == "string") {
      return "'" + val.replace(/'/g, "\\'") + "'";
    }
    else if (val === undefined) {
      return "null";
    } else {
      return JSON.stringify(val);
    }
  }

  private getPKFields(): string[] {
    return this.pkFields
  }

  private toEntity(row:any): T {
    for (const arr of this.arrays) {
      row[arr] = row[arr] ? JSON.parse(row[arr]) : [];
    }
    // Big integers are stored as strings to avoid data loss
    for (const bigint of this.bigintegers) {
      if (row[bigint] !== null && row[bigint] !== undefined) {
        row[bigint] = parseInt(row[bigint]);
      }
    }
    // Booleans
    for (const f of this.booleans) {
      row[f] = row[f] !== null ? Boolean(row[f]) : null;
    }
    // Transient
    for (const f of (this.transientFields || [])) {
      row[f] = row[f];
    }
    return row;
  }

  private toRow(entity:any): any {
    let row:any = {};
    for (const f of this.fields) {
      row[f] = entity[f]
    }
    for (const arr of this.arrays) {
      row[arr] = JSON.stringify(row[arr] || []);
    }
    // Big integers are stored as strings to avoid data loss
    for (const bigint of this.bigintegers) {
      if (entity[bigint] === null || entity[bigint] === undefined) {
        row[bigint] = null;
      } else {
        row[bigint] = String(entity[bigint]);
      }
    }
    return row;
  }
}
