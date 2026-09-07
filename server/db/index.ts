import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "server", "data", "store.json");

// In-memory cache of collections backed by persistent store.json
let memoryStore: Record<string, Record<string, any>> = {};
let isStoreLoaded = false;
let saveTimeout: any = null;

export function loadStore() {
  if (isStoreLoaded) return memoryStore;
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      memoryStore = JSON.parse(raw);
    } else {
      memoryStore = {};
    }
  } catch (err) {
    console.warn("[LocalStore] Warning loading store.json:", err);
    memoryStore = {};
  }
  isStoreLoaded = true;
  return memoryStore;
}

export function persistStore() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryStore, null, 2), "utf-8");
  } catch (err) {
    console.error("[LocalStore] Failed to persist store.json:", err);
  }
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(persistStore, 50);
}

export const eq = (field: any, value: any) => ({ type: "eq", field, value });
export const and = (...args: any[]) => ({ type: "and", args });
export const or = (...args: any[]) => ({ type: "or", args });
export const desc = (field: any) => ({ type: "desc", field });
export const asc = (field: any) => ({ type: "asc", field });
export const sql = (strings: any, ...values: any[]) => ({ type: "sql", strings, values });
export const count = () => ({ type: "count" });

function resolveField(docData, fieldDef, joinsData = {}) {
  if (!fieldDef) return undefined;
  if (fieldDef._name && fieldDef._col) {
    if (docData._tableName === fieldDef._name) {
      return docData[fieldDef._col];
    }
    if (joinsData && joinsData[fieldDef._name]) {
      return joinsData[fieldDef._name][fieldDef._col];
    }
    return docData[fieldDef._col];
  }
  return docData[fieldDef];
}

function normalizeVal(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = Date.parse(v);
    if (!isNaN(d)) return d;
  }
  return v;
}

function convertTimestamps(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj;
  if (typeof obj.toDate === "function") {
    return obj.toDate();
  }
  if (Array.isArray(obj)) {
    return obj.map(convertTimestamps);
  }
  const res: any = {};
  for (const [k, v] of Object.entries(obj)) {
    res[k] = convertTimestamps(v);
  }
  return res;
}

function removeUndefined(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj;
  if (typeof obj.toDate === "function") return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  const cleaned = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      cleaned[key] = removeUndefined(val);
    }
  }
  return cleaned;
}

function evaluateSingleCondition(docData, cond, joinsData = {}) {
  if (!cond) return true;

  // Custom condition types
  if (cond.type === "eq") {
    const left = resolveField(docData, cond.field, joinsData) ?? cond.field;
    const right = resolveField(docData, cond.value, joinsData) ?? cond.value;
    return normalizeVal(left) === normalizeVal(right);
  }
  if (cond.type === "and") {
    return cond.args.every((c) => evaluateSingleCondition(docData, c, joinsData));
  }
  if (cond.type === "or") {
    return cond.args.some((c) => evaluateSingleCondition(docData, c, joinsData));
  }

  // Drizzle ORM SQL condition
  if (cond.queryChunks) {
    const chunks = cond.queryChunks;
    if (chunks.length === 0) return true;

    // Compound expression: [ '(', SQL { queryChunks: [ ... ] }, ')' ]
    if (
      chunks.length === 3 &&
      chunks[0]?.constructor?.name === "StringChunk" &&
      chunks[0].value[0] === "(" &&
      chunks[2]?.constructor?.name === "StringChunk" &&
      chunks[2].value[0] === ")"
    ) {
      const inner = chunks[1];
      if (inner && inner.queryChunks) {
        let isOr = false;
        const subExprs = [];
        for (const ch of inner.queryChunks) {
          if (ch?.constructor?.name === "StringChunk") {
            const str = ch.value.join("");
            if (str.includes(" or ")) isOr = true;
          } else if (ch?.queryChunks) {
            subExprs.push(ch);
          }
        }
        if (isOr) {
          return subExprs.some((expr) => evaluateSingleCondition(docData, expr, joinsData));
        } else {
          return subExprs.every((expr) => evaluateSingleCondition(docData, expr, joinsData));
        }
      }
    }

    let leftDef = null;
    let rightDef = null;
    let op = "";
    let val = undefined;

    for (const ch of chunks) {
      if (ch && ch._name && ch._col) {
        if (!leftDef) leftDef = ch;
        else rightDef = ch;
      } else if (ch?.constructor?.name === "StringChunk") {
        const text = ch.value.join("").trim();
        if (text) op = text;
      } else if (ch?.queryChunks) {
        return evaluateSingleCondition(docData, ch, joinsData);
      } else {
        val = ch;
      }
    }

    if (!leftDef) return true;
    const docVal = resolveField(docData, leftDef, joinsData);
    const rightVal = rightDef ? resolveField(docData, rightDef, joinsData) : val;

    const nDocVal = normalizeVal(docVal);
    const nVal = normalizeVal(rightVal);

    if (op === "=") return nDocVal === nVal;
    if (op === "<>" || op === "!=") return nDocVal !== nVal;
    if (op === ">") return nDocVal > nVal;
    if (op === ">=") return nDocVal >= nVal;
    if (op === "<") return nDocVal < nVal;
    if (op === "<=") return nDocVal <= nVal;
    if (op === "is null") return docVal == null;
    if (op === "is not null") return docVal != null;
    if (op === "in") return Array.isArray(val) && val.includes(docVal);
    if (op === "not in") return Array.isArray(val) && !val.includes(docVal);

    return true;
  }

  return true;
}

class QueryBuilder {
  action: any;
  table: any;
  data: any;
  conditions: any[];
  joins: any[];
  _limit: any;
  _orderBy: any;
  _selectFields: any;
  _returning: boolean;
  _onConflictNothing: boolean;
  _onConflictUpdate: any;

  constructor(action?: any, table?: any, data?: any) {
    this.action = action;
    this.table = table;
    this.data = data;
    this.conditions = [];
    this.joins = [];
    this._limit = null;
    this._orderBy = null;
    this._selectFields = null;
    this._returning = false;
    this._onConflictNothing = false;
    this._onConflictUpdate = null;
  }

  select(fields?: any) {
    const q = new QueryBuilder("select");
    q._selectFields = fields;
    return q;
  }
  from(table: any) {
    this.table = table;
    return this;
  }
  where(cond: any) {
    if (cond) this.conditions.push(cond);
    return this;
  }
  limit(n: number) {
    this._limit = n;
    return this;
  }
  orderBy(...ords: any[]) {
    this._orderBy = ords[0];
    return this;
  }
  values(data: any) {
    this.data = data;
    return this;
  }
  set(data) {
    this.data = data;
    return this;
  }
  onConflictDoNothing() {
    this._onConflictNothing = true;
    return this;
  }
  onConflictDoUpdate(config) {
    this._onConflictUpdate = config;
    return this;
  }
  returning() {
    this._returning = true;
    return this;
  }
  leftJoin(table, condition) {
    this.joins.push({ table: table._name, condition, type: "left" });
    return this;
  }
  innerJoin(table, condition) {
    this.joins.push({ table: table._name, condition, type: "inner" });
    return this;
  }

  async then(resolve, reject) {
    try {
      const res = await this.execute();
      resolve(res);
    } catch (e) {
      reject(e);
    }
  }

  async execute() {
    const tableName = this.table?._name || this.table;
    if (!tableName) return [];

    if (this.action === "select") {
      loadStore();
      const tableData = memoryStore[tableName] || {};
      const docsData = Object.values(tableData).map((d: any) => ({ ...convertTimestamps(d), id: d.id, _tableName: tableName }));

      let results = [];
      for (const docData of docsData) {
        const joinsData: any = {};
        let skip = false;

        for (const join of this.joins) {
          const joinData = memoryStore[join.table] || {};
          const joinDocs = Object.values(joinData).map((d: any) => ({ ...convertTimestamps(d), id: d.id, _tableName: join.table }));

          const matched = joinDocs.find((jd) =>
            evaluateSingleCondition(docData, join.condition, { [join.table]: jd })
          );
          if (matched) {
            joinsData[join.table] = matched;
          } else if (join.type === "inner") {
            skip = true;
            break;
          }
        }

        if (skip) continue;

        if (this.conditions.length > 0) {
          const matchFilter = this.conditions.every((c) =>
            evaluateSingleCondition(docData, c, joinsData)
          );
          if (!matchFilter) continue;
        }

        if (this._selectFields) {
          const mapped: any = {};
          for (const [key, fieldDef] of Object.entries(this._selectFields)) {
            mapped[key] = resolveField(docData, fieldDef, joinsData);
          }
          results.push(mapped);
        } else {
          results.push(docData);
        }
      }

      if (this._orderBy) {
        let fieldDef = this._orderBy.field;
        let dir = this._orderBy.type === "desc" ? -1 : 1;

        if (this._orderBy.queryChunks) {
          for (const ch of this._orderBy.queryChunks) {
            if (ch && ch._name && ch._col) fieldDef = ch;
            if (ch?.constructor?.name === "StringChunk") {
              const str = ch.value.join("");
              if (str.includes("desc")) dir = -1;
              if (str.includes("asc")) dir = 1;
            }
          }
        } else if (this._orderBy._name && this._orderBy._col) {
          fieldDef = this._orderBy;
          dir = 1;
        }

        if (fieldDef) {
          results.sort((a, b) => {
            const valA = resolveField(a, fieldDef);
            const valB = resolveField(b, fieldDef);
            if (valA == null && valB == null) return 0;
            return valA < valB ? -dir : valA > valB ? dir : 0;
          });
        }
      }

      if (this._limit) results = results.slice(0, this._limit);
      return results;
    }

    if (this.action === "insert") {
      loadStore();
      if (!memoryStore[tableName]) memoryStore[tableName] = {};
      const isArray = Array.isArray(this.data);
      const items = isArray ? this.data : [this.data];
      const results = [];
      for (const item of items) {
        const id = item.id || String(uuidv4());
        let docData = { ...item, id };
        if (!docData.createdAt && tableName !== "settings") {
          docData.createdAt = new Date().toISOString();
        }
        if (!docData.updatedAt && tableName !== "settings") {
          docData.updatedAt = new Date().toISOString();
        }
        if (this._onConflictUpdate && this._onConflictUpdate.set) {
          docData = { ...docData, ...this._onConflictUpdate.set };
        }
        const cleaned = removeUndefined(docData);
        memoryStore[tableName][id] = cleaned;
        results.push(cleaned);
      }
      scheduleSave();
      return results;
    }

    if (this.action === "update") {
      loadStore();
      if (!memoryStore[tableName]) memoryStore[tableName] = {};
      const tableData = memoryStore[tableName];
      const docsData = Object.values(tableData).map((d: any) => ({ ...convertTimestamps(d), id: d.id, _tableName: tableName }));

      const updated = [];
      const cleanedUpdate = removeUndefined(this.data);
      for (const docData of docsData) {
        const matchFilter = this.conditions.every((c) => evaluateSingleCondition(docData, c));
        if (matchFilter) {
          const newDoc = { ...docData, ...cleanedUpdate };
          delete newDoc._tableName;
          memoryStore[tableName][docData.id] = newDoc;
          updated.push(newDoc);
        }
      }
      scheduleSave();
      return updated;
    }

    if (this.action === "delete") {
      loadStore();
      if (!memoryStore[tableName]) memoryStore[tableName] = {};
      const tableData = memoryStore[tableName];
      const docsData = Object.values(tableData).map((d: any) => ({ ...convertTimestamps(d), id: d.id, _tableName: tableName }));

      const deleted = [];
      for (const docData of docsData) {
        const matchFilter = this.conditions.every((c) => evaluateSingleCondition(docData, c));
        if (matchFilter) {
          delete memoryStore[tableName][docData.id];
          deleted.push(docData);
        }
      }
      scheduleSave();
      return deleted;
    }
  }
}

export const db: any = {
  select: (fields?: any) => new QueryBuilder("select").select(fields),
  insert: (table?: any) => new QueryBuilder("insert", table),
  update: (table?: any) => new QueryBuilder("update", table),
  delete: (table?: any) => new QueryBuilder("delete", table),
  transaction: async (cb: any) => {
    return await cb(db);
  },
  execute: async (sqlQuery: any) => {
    if (
      sqlQuery &&
      sqlQuery.strings &&
      sqlQuery.strings.some((s: any) => typeof s === "string" && s.toUpperCase().includes("TRUNCATE"))
    ) {
      loadStore();
      const collections = [
        "appointments",
        "patients",
        "services",
        "providers",
        "patient_recalls",
        "waitlist",
        "push_subscriptions",
        "provider_services",
        "appointment_holds",
        "audit_logs",
        "resources",
      ];
      for (const col of collections) {
        if (memoryStore[col]) {
          memoryStore[col] = {};
        }
      }
      scheduleSave();
    }
    return [];
  },
};
