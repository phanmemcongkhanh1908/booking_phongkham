import crypto from "crypto";
import fs from "fs";
import path from "path";
import { appContext } from "../core/context.js";

const DB_FILE = path.join(process.cwd(), "server", "data", "store.json");

// In-memory cache of collections backed by persistent store.json
let memoryStore: Record<string, Record<string, any>> = {};
let isStoreLoaded = false;
let saveTimeout: NodeJS.Timeout | null = null;
let maxWaitTimeout: NodeJS.Timeout | null = null;
let isDirty = false;
let persistChain: Promise<void> = Promise.resolve();

// Strict multi-tenant collections that MUST ALWAYS filter by tenantId when a clinic context is active
const STRICT_TENANT_TABLES = new Set([
  "appointments",
  "patients",
  "appointment_holds",
  "patient_recalls",
  "waitlist",
  "audit_logs",
]);

// Active transaction undo log so rollback is O(modified rows) instead of O(entire database)
type TxBackupEntry = { existed: boolean; value: any };
let activeTxBackup: Map<string, Map<string, TxBackupEntry>> | null = null;
let dirtyDuringTx = false;

function cloneForRollback(val: any): any {
  if (val === null || typeof val !== "object") return val;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(val);
    } catch {
      // Fallback for non-cloneable edge objects
    }
  }
  return JSON.parse(JSON.stringify(val));
}

function recordTxBackup(tableName: string, storeKey: string) {
  if (!activeTxBackup) return;
  let tableMap = activeTxBackup.get(tableName);
  if (!tableMap) {
    tableMap = new Map<string, TxBackupEntry>();
    activeTxBackup.set(tableName, tableMap);
  }
  if (tableMap.has(storeKey)) return;

  const tableObj = memoryStore[tableName];
  if (tableObj && Object.prototype.hasOwnProperty.call(tableObj, storeKey)) {
    tableMap.set(storeKey, { existed: true, value: cloneForRollback(tableObj[storeKey]) });
  } else {
    tableMap.set(storeKey, { existed: false, value: undefined });
  }
}

function rollbackTxBackup() {
  if (!activeTxBackup) return;
  for (const [tableName, tableMap] of activeTxBackup.entries()) {
    if (!memoryStore[tableName]) memoryStore[tableName] = {};
    for (const [storeKey, entry] of tableMap.entries()) {
      if (entry.existed) {
        memoryStore[tableName][storeKey] = entry.value;
      } else {
        delete memoryStore[tableName][storeKey];
      }
    }
  }
}

export function loadStore() {
  if (isStoreLoaded) return memoryStore;
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      memoryStore = raw.trim() ? JSON.parse(raw) : {};
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

function serializeStore(): string {
  // Use fast compact JSON once dataset grows to keep disk I/O and memory overhead minimal
  let approxDocs = 0;
  for (const col in memoryStore) {
    const t = memoryStore[col];
    if (t && typeof t === "object") {
      approxDocs += Object.keys(t).length;
      if (approxDocs > 150) break;
    }
  }
  return approxDocs > 150 ? JSON.stringify(memoryStore) : JSON.stringify(memoryStore, null, 2);
}

export function persistStore() {
  try {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    if (maxWaitTimeout) {
      clearTimeout(maxWaitTimeout);
      maxWaitTimeout = null;
    }
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(tempFile, serializeStore(), "utf-8");
    fs.renameSync(tempFile, DB_FILE);
    isDirty = false;
  } catch (err) {
    console.error("[LocalStore] Failed to persist store.json:", err);
  }
}

async function persistStoreAsync(): Promise<void> {
  if (!isDirty) return;
  const serialized = serializeStore();
  isDirty = false;
  persistChain = persistChain.then(async () => {
    try {
      const dir = path.dirname(DB_FILE);
      await fs.promises.mkdir(dir, { recursive: true });
      const tempFile = `${DB_FILE}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
      await fs.promises.writeFile(tempFile, serialized, "utf-8");
      await fs.promises.rename(tempFile, DB_FILE);
    } catch (err) {
      isDirty = true;
      console.error("[LocalStore] Failed async persist store.json:", err);
    }
  });
  return persistChain;
}

export async function flushStore(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (maxWaitTimeout) {
    clearTimeout(maxWaitTimeout);
    maxWaitTimeout = null;
  }
  await persistStoreAsync();
  await persistChain;
}

function scheduleSave() {
  if (activeTxBackup) {
    dirtyDuringTx = true;
    return;
  }
  isDirty = true;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    if (maxWaitTimeout) {
      clearTimeout(maxWaitTimeout);
      maxWaitTimeout = null;
    }
    void persistStoreAsync();
  }, 80);
  if (saveTimeout.unref) saveTimeout.unref();

  if (!maxWaitTimeout) {
    maxWaitTimeout = setTimeout(() => {
      maxWaitTimeout = null;
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      void persistStoreAsync();
    }, 450);
    if (maxWaitTimeout.unref) maxWaitTimeout.unref();
  }
}

// Ensure store is always persisted cleanly on process shutdown
process.on("beforeExit", () => {
  if (isDirty) persistStore();
});
process.on("SIGINT", () => {
  if (isDirty) persistStore();
});
process.on("SIGTERM", () => {
  if (isDirty) persistStore();
});

export const eq = (field: any, value: any) => ({ type: "eq", field, value });
export const and = (...args: any[]) => ({ type: "and", args });
export const or = (...args: any[]) => ({ type: "or", args });
export const desc = (field: any) => ({ type: "desc", field });
export const asc = (field: any) => ({ type: "asc", field });
export const sql = (strings: any, ...values: any[]) => ({ type: "sql", strings, values });
export const count = () => ({ type: "count" });

function resolveField(docData: any, fieldDef: any, joinsData: any = {}) {
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
  if (typeof fieldDef === "string") {
    return docData[fieldDef];
  }
  return undefined;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function normalizeVal(v: any) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" && v.length >= 10 && ISO_DATE_RE.test(v)) {
    const d = Date.parse(v);
    if (!Number.isNaN(d)) return d;
  }
  return v;
}

function convertTimestamps(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj;
  if (typeof obj.toDate === "function") {
    return obj.toDate();
  }
  if (Array.isArray(obj)) {
    const arr = new Array(obj.length);
    for (let i = 0; i < obj.length; i++) {
      arr[i] = convertTimestamps(obj[i]);
    }
    return arr;
  }
  const res: any = {};
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      res[k] = convertTimestamps(obj[k]);
    }
  }
  return res;
}

function removeUndefined(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj;
  if (typeof obj.toDate === "function") return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  const cleaned: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = removeUndefined(val);
      }
    }
  }
  return cleaned;
}

function normalizeSearchString(str: any): string {
  if (str == null) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function extractEquiJoinPair(cond: any, joinTableName: string): { mainDef: any; joinDef: any } | null {
  if (!cond) return null;
  if (cond.type === "eq") {
    const l = cond.field;
    const r = cond.value;
    if (l?._name && l?._col && r?._name && r?._col) {
      if (r._name === joinTableName && l._name !== joinTableName) return { mainDef: l, joinDef: r };
      if (l._name === joinTableName && r._name !== joinTableName) return { mainDef: r, joinDef: l };
    }
    return null;
  }
  if (cond.queryChunks) {
    const chunks = cond.queryChunks;
    if (
      chunks.length === 3 &&
      chunks[0]?.constructor?.name === "StringChunk" &&
      chunks[0].value[0] === "(" &&
      chunks[2]?.constructor?.name === "StringChunk" &&
      chunks[2].value[0] === ")"
    ) {
      return extractEquiJoinPair(chunks[1], joinTableName);
    }
    let leftDef: any = null;
    let rightDef: any = null;
    let op = "";
    for (const ch of chunks) {
      if (ch && ch._name && ch._col) {
        if (!leftDef) leftDef = ch;
        else rightDef = ch;
      } else if (ch?.constructor?.name === "StringChunk") {
        const text = ch.value.join("").trim();
        if (text) op = text;
      }
    }
    if (op === "=" && leftDef && rightDef) {
      if (rightDef._name === joinTableName && leftDef._name !== joinTableName) {
        return { mainDef: leftDef, joinDef: rightDef };
      }
      if (leftDef._name === joinTableName && rightDef._name !== joinTableName) {
        return { mainDef: rightDef, joinDef: leftDef };
      }
    }
  }
  return null;
}

function evaluateSingleCondition(docData: any, cond: any, joinsData: any = {}): boolean {
  if (!cond) return true;

  // Custom condition types
  if (cond.type === "eq") {
    const left = resolveField(docData, cond.field, joinsData) ?? cond.field;
    const right = resolveField(docData, cond.value, joinsData) ?? cond.value;
    return normalizeVal(left) === normalizeVal(right);
  }
  if (cond.type === "and") {
    return cond.args.every((c: any) => evaluateSingleCondition(docData, c, joinsData));
  }
  if (cond.type === "or") {
    return cond.args.some((c: any) => evaluateSingleCondition(docData, c, joinsData));
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

    let leftDef: any = null;
    let rightDef: any = null;
    let op = "";
    let val: any = undefined;

    for (const ch of chunks) {
      if (ch && ch._name && ch._col) {
        if (!leftDef) leftDef = ch;
        else rightDef = ch;
      } else if (ch?.constructor?.name === "StringChunk") {
        const text = ch.value.join("").trim();
        if (text) {
          const lower = text.toLowerCase();
          const notInMatch = text.match(/not\s+in\s*\(([^)]+)\)/i);
          const inMatch = text.match(/\bin\s*\(([^)]+)\)/i);
          if (notInMatch) {
            op = "not in";
            val = notInMatch[1].split(",").map((s: string) => s.trim().replace(/^['"]|['"]$/g, ""));
          } else if (inMatch) {
            op = "in";
            val = inMatch[1].split(",").map((s: string) => s.trim().replace(/^['"]|['"]$/g, ""));
          } else if (lower.includes("like")) {
            op = "like";
          } else if (lower === "in") {
            op = "in";
          } else if (lower === "not in") {
            op = "not in";
          } else {
            op = text;
          }
        }
      } else if (ch?.queryChunks) {
        return evaluateSingleCondition(docData, ch, joinsData);
      } else {
        if (val === undefined) {
          val = ch;
        }
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

    if (op === "in") {
      const targetArray = Array.isArray(rightVal) ? rightVal : Array.isArray(val) ? val : [rightVal];
      return targetArray.map(normalizeVal).includes(nDocVal);
    }
    if (op === "not in") {
      const targetArray = Array.isArray(rightVal) ? rightVal : Array.isArray(val) ? val : [rightVal];
      return !targetArray.map(normalizeVal).includes(nDocVal);
    }
    if (op === "like") {
      const pattern = String(rightVal || val || "").replace(/%/g, "");
      const normalizedSource = normalizeSearchString(docVal);
      const normalizedTarget = normalizeSearchString(pattern);
      return normalizedSource.includes(normalizedTarget);
    }

    return true;
  }

  return true;
}

function isRowVisibleForTenant(
  tableName: string,
  rawDoc: any,
  tenantId: string | null | undefined,
  isFullAdmin: boolean | undefined,
  tenantHasCustomServices: boolean,
  tenantHasCustomProviders: boolean
): boolean {
  if (isFullAdmin || !tenantId || tableName === "roles") return true;

  if (STRICT_TENANT_TABLES.has(tableName)) {
    return rawDoc.tenantId === tenantId;
  }
  if (tableName === "services") {
    return tenantHasCustomServices ? rawDoc.tenantId === tenantId : !rawDoc.tenantId || rawDoc.tenantId === tenantId;
  }
  if (tableName === "providers") {
    return tenantHasCustomProviders ? rawDoc.tenantId === tenantId : !rawDoc.tenantId || rawDoc.tenantId === tenantId;
  }
  return !rawDoc.tenantId || rawDoc.tenantId === tenantId;
}

class QueryBuilder {
  action: any;
  table: any;
  data: any;
  conditions: any[];
  joins: any[];
  _limit: any;
  _offset: any;
  _orderBy: any;
  _groupBy: any[];
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
    this._offset = null;
    this._orderBy = null;
    this._groupBy = [];
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
  offset(n: number) {
    this._offset = n;
    return this;
  }
  orderBy(...ords: any[]) {
    this._orderBy = ords[0];
    return this;
  }
  groupBy(...cols: any[]) {
    this._groupBy = cols;
    return this;
  }
  values(data: any) {
    this.data = data;
    return this;
  }
  set(data: any) {
    this.data = data;
    return this;
  }
  onConflictDoNothing() {
    this._onConflictNothing = true;
    return this;
  }
  onConflictDoUpdate(config: any) {
    this._onConflictUpdate = config;
    return this;
  }
  returning() {
    this._returning = true;
    return this;
  }
  leftJoin(table: any, condition: any) {
    this.joins.push({ table: table._name, condition, type: "left" });
    return this;
  }
  innerJoin(table: any, condition: any) {
    this.joins.push({ table: table._name, condition, type: "inner" });
    return this;
  }

  async then(resolve: any, reject: any) {
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

      const ctx = appContext.getStore();
      const tenantId = ctx?.tenantId;
      const isFullAdmin = ctx?.isFullAdmin;

      let tenantHasCustomServices = false;
      let tenantHasCustomProviders = false;
      if (!isFullAdmin && tenantId) {
        if (tableName === "services" && memoryStore["services"]) {
          const isFlagged = memoryStore["settings"]?.[`${tenantId}__services_customized`]?.value === true;
          tenantHasCustomServices =
            isFlagged || Object.values(memoryStore["services"]).some((s: any) => s.tenantId === tenantId);
        }
        if (tableName === "providers" && memoryStore["providers"]) {
          const isFlagged = memoryStore["settings"]?.[`${tenantId}__providers_customized`]?.value === true;
          tenantHasCustomProviders =
            isFlagged || Object.values(memoryStore["providers"]).some((p: any) => p.tenantId === tenantId);
        }
      }

      // 1. Pre-build each joined table ONCE per query (with O(1) EquiJoin hash index when applicable)
      const preparedJoins = this.joins.map((join) => {
        const joinData = memoryStore[join.table] || {};
        const equiPair = extractEquiJoinPair(join.condition, join.table);

        // Build O(1) indexed lookup map or fallback pre-converted array
        let indexMap: Map<any, any> | null = null;
        let preConvertedList: any[] | null = null;

        if (equiPair) {
          indexMap = new Map<any, any>();
          const joinCol = equiPair.joinDef._col;
          for (const k in joinData) {
            if (!Object.prototype.hasOwnProperty.call(joinData, k)) continue;
            const jd = joinData[k];
            const rawKeyVal = jd[joinCol];
            if (rawKeyVal !== undefined && rawKeyVal !== null) {
              const normKey = normalizeVal(rawKeyVal);
              const existing = indexMap.get(normKey);
              // Prefer tenant-specific match over global fallback when duplicate keys exist
              if (!existing || (tenantId && jd.tenantId === tenantId && existing.tenantId !== tenantId)) {
                indexMap.set(normKey, {
                  ...convertTimestamps(jd),
                  id: jd.id,
                  _storeKey: k,
                  _tableName: join.table,
                });
              }
            }
          }
        } else {
          preConvertedList = [];
          for (const k in joinData) {
            if (!Object.prototype.hasOwnProperty.call(joinData, k)) continue;
            const jd = joinData[k];
            preConvertedList.push({
              ...convertTimestamps(jd),
              id: jd.id,
              _storeKey: k,
              _tableName: join.table,
            });
          }
        }

        return {
          ...join,
          equiPair,
          indexMap,
          preConvertedList,
        };
      });

      // 2. Filter outer table by tenant BEFORE expensive cloning/conversions
      let results: any[] = [];
      for (const key in tableData) {
        if (!Object.prototype.hasOwnProperty.call(tableData, key)) continue;
        const rawDoc = tableData[key];
        if (
          !isRowVisibleForTenant(
            tableName,
            rawDoc,
            tenantId,
            isFullAdmin,
            tenantHasCustomServices,
            tenantHasCustomProviders
          )
        ) {
          continue;
        }

        const docData: any = {
          ...convertTimestamps(rawDoc),
          id: rawDoc.id,
          _storeKey: key,
          _tableName: tableName,
        };

        const joinsData: any = {};
        let skip = false;

        for (const join of preparedJoins) {
          let matched: any = undefined;
          if (join.equiPair && join.indexMap) {
            const lookupSourceVal = resolveField(docData, join.equiPair.mainDef, joinsData);
            if (lookupSourceVal !== undefined && lookupSourceVal !== null) {
              matched = join.indexMap.get(normalizeVal(lookupSourceVal));
            }
          } else if (join.preConvertedList) {
            matched = join.preConvertedList.find((jd) =>
              evaluateSingleCondition(docData, join.condition, { [join.table]: jd })
            );
          }

          if (matched) {
            joinsData[join.table] = matched;
          } else if (join.type === "inner") {
            skip = true;
            break;
          }
        }

        if (skip) continue;

        if (this.conditions.length > 0) {
          const matchFilter = this.conditions.every((c) => evaluateSingleCondition(docData, c, joinsData));
          if (!matchFilter) continue;
        }

        if (this._groupBy && this._groupBy.length > 0) {
          results.push({ docData, joinsData });
        } else if (this._selectFields) {
          const mapped: any = {};
          for (const [fKey, fieldDef] of Object.entries(this._selectFields)) {
            mapped[fKey] = resolveField(docData, fieldDef, joinsData);
          }
          results.push(mapped);
        } else {
          const cleanDoc = { ...docData };
          delete cleanDoc._storeKey;
          delete cleanDoc._tableName;
          results.push(cleanDoc);
        }
      }

      // 3. Handle GROUP BY + aggregates (e.g. sql`count(...)` in analytics)
      if (this._groupBy && this._groupBy.length > 0) {
        const groups = new Map<string, { firstRow: any; count: number }>();
        for (const entry of results) {
          const groupKey = this._groupBy
            .map((col: any) => String(resolveField(entry.docData, col, entry.joinsData) ?? "__NULL__"))
            .join("||");
          const existing = groups.get(groupKey);
          if (existing) {
            existing.count += 1;
          } else {
            groups.set(groupKey, { firstRow: entry, count: 1 });
          }
        }
        const groupedResults: any[] = [];
        for (const { firstRow, count: groupCount } of groups.values()) {
          if (this._selectFields) {
            const mapped: any = {};
            for (const [fKey, fieldDef] of Object.entries(this._selectFields) as [string, any][]) {
              const isCountAggregate =
                fieldDef?.type === "count" ||
                (fieldDef?.queryChunks &&
                  fieldDef.queryChunks.some(
                    (c: any) =>
                      c?.constructor?.name === "StringChunk" &&
                      String(c.value?.join?.("") || "").toLowerCase().includes("count")
                  ));
              if (isCountAggregate) {
                mapped[fKey] = groupCount;
              } else {
                mapped[fKey] = resolveField(firstRow.docData, fieldDef, firstRow.joinsData);
              }
            }
            groupedResults.push(mapped);
          } else {
            const cleanDoc = { ...firstRow.docData };
            delete cleanDoc._storeKey;
            delete cleanDoc._tableName;
            groupedResults.push(cleanDoc);
          }
        }
        results = groupedResults;
      }

      // Prioritize tenant-specific records over global fallback records if tenantId is active
      if (tenantId && results.length > 1) {
        results.sort((a, b) => {
          const aMatch = a.tenantId === tenantId ? 1 : 0;
          const bMatch = b.tenantId === tenantId ? 1 : 0;
          return bMatch - aMatch;
        });
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
            const valA = normalizeVal(resolveField(a, fieldDef));
            const valB = normalizeVal(resolveField(b, fieldDef));
            if (valA == null && valB == null) return 0;
            if (valA == null) return dir;
            if (valB == null) return -dir;
            return valA < valB ? -dir : valA > valB ? dir : 0;
          });
        }
      }

      const start = typeof this._offset === "number" ? Math.max(0, this._offset) : 0;
      if (typeof this._limit === "number") {
        results = results.slice(start, start + this._limit);
      } else if (start > 0) {
        results = results.slice(start);
      }
      return results;
    }

    if (this.action === "insert") {
      loadStore();
      if (!memoryStore[tableName]) memoryStore[tableName] = {};
      const isArray = Array.isArray(this.data);
      const items = isArray ? this.data : [this.data];
      const results = [];

      const ctx = appContext.getStore();
      const tenantId = ctx?.tenantId;

      for (const item of items) {
        const id = item.id || crypto.randomUUID();
        let docData = { ...item, id };

        const effectiveTenantId = docData.tenantId || tenantId;
        if (effectiveTenantId && !docData.tenantId && tableName !== "roles") {
          docData.tenantId = effectiveTenantId;
        }

        const storeKey = tableName === "settings" && effectiveTenantId ? `${effectiveTenantId}__${id}` : id;
        const alreadyExists = Object.prototype.hasOwnProperty.call(memoryStore[tableName], storeKey);

        if (this._onConflictNothing && alreadyExists) {
          results.push(memoryStore[tableName][storeKey]);
          continue;
        }

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
        recordTxBackup(tableName, storeKey);
        memoryStore[tableName][storeKey] = cleaned;
        results.push(cleaned);
      }
      scheduleSave();
      return results;
    }

    if (this.action === "update") {
      loadStore();
      if (!memoryStore[tableName]) memoryStore[tableName] = {};
      const tableData = memoryStore[tableName];

      const ctx = appContext.getStore();
      const tenantId = ctx?.tenantId;
      const isFullAdmin = ctx?.isFullAdmin;

      const updated = [];
      const cleanedUpdate = removeUndefined(this.data);
      for (const key in tableData) {
        if (!Object.prototype.hasOwnProperty.call(tableData, key)) continue;
        const rawDoc = tableData[key];
        if (!isFullAdmin && tenantId && tableName !== "roles") {
          if (rawDoc.tenantId !== tenantId) {
            continue;
          }
        }
        const docData: any = {
          ...convertTimestamps(rawDoc),
          id: rawDoc.id,
          _storeKey: key,
          _tableName: tableName,
        };
        const matchFilter = this.conditions.every((c) => evaluateSingleCondition(docData, c));
        if (matchFilter) {
          const newDoc = { ...docData, ...cleanedUpdate };
          delete newDoc._tableName;
          const storeKey = newDoc._storeKey || docData.id;
          delete newDoc._storeKey;
          recordTxBackup(tableName, storeKey);
          memoryStore[tableName][storeKey] = newDoc;
          updated.push(newDoc);
        }
      }
      if (updated.length > 0) {
        scheduleSave();
      }
      return updated;
    }

    if (this.action === "delete") {
      loadStore();
      if (!memoryStore[tableName]) memoryStore[tableName] = {};
      const tableData = memoryStore[tableName];

      const ctx = appContext.getStore();
      const tenantId = ctx?.tenantId;
      const isFullAdmin = ctx?.isFullAdmin;

      const deleted = [];
      const keysToDelete: { storeKey: string; cleanDoc: any }[] = [];
      for (const key in tableData) {
        if (!Object.prototype.hasOwnProperty.call(tableData, key)) continue;
        const rawDoc = tableData[key];
        if (!isFullAdmin && tenantId && tableName !== "roles") {
          if (rawDoc.tenantId !== tenantId) {
            continue;
          }
        }
        const docData: any = {
          ...convertTimestamps(rawDoc),
          id: rawDoc.id,
          _storeKey: key,
          _tableName: tableName,
        };
        const matchFilter = this.conditions.every((c) => evaluateSingleCondition(docData, c));
        if (matchFilter) {
          const storeKey = docData._storeKey || docData.id;
          const cleanDoc = { ...docData };
          delete cleanDoc._storeKey;
          delete cleanDoc._tableName;
          keysToDelete.push({ storeKey, cleanDoc });
        }
      }
      for (const item of keysToDelete) {
        recordTxBackup(tableName, item.storeKey);
        delete memoryStore[tableName][item.storeKey];
        deleted.push(item.cleanDoc);
      }
      if (deleted.length > 0) {
        scheduleSave();
      }
      return deleted;
    }
  }
}

let transactionQueue: Promise<any> = Promise.resolve();

export const db: any = {
  select: (fields?: any) => new QueryBuilder("select").select(fields),
  insert: (table?: any) => new QueryBuilder("insert", table),
  update: (table?: any) => new QueryBuilder("update", table),
  delete: (table?: any) => new QueryBuilder("delete", table),
  transaction: async (cb: any, _config?: { isolationLevel?: string }) => {
    const runInLock = async () => {
      loadStore();
      activeTxBackup = new Map<string, Map<string, TxBackupEntry>>();
      dirtyDuringTx = false;
      try {
        const result = await cb(db);
        const shouldSave = dirtyDuringTx;
        activeTxBackup = null;
        dirtyDuringTx = false;
        if (shouldSave) {
          scheduleSave();
        }
        return result;
      } catch (err) {
        try {
          rollbackTxBackup();
        } catch (rollbackErr) {
          console.error("[LocalStore] Rollback error:", rollbackErr);
        } finally {
          activeTxBackup = null;
          dirtyDuringTx = false;
        }
        throw err;
      }
    };

    const previousQueue = transactionQueue;
    let resolveLock: (value?: any) => void;
    transactionQueue = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    try {
      await previousQueue;
      return await runInLock();
    } finally {
      resolveLock!();
    }
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
