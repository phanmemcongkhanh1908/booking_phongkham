import fs from 'fs';
const file = 'server/db/index.ts';
let code = fs.readFileSync(file, 'utf8');

const targetUpdate = `    if (this.action === "update") {
      loadStore();
      if (!memoryStore[tableName]) memoryStore[tableName] = {};
      const tableData = memoryStore[tableName];
      const docsData = Object.values(tableData).map((d: any) => ({ ...convertTimestamps(d), id: d.id, _tableName: tableName }));

      const updated = [];
      const cleanedUpdate = removeUndefined(this.data);
      for (const docData of docsData) {
        const matchFilter = this.conditions.every((c) => evaluateSingleCondition(docData, c));`;

const replaceUpdate = `    if (this.action === "update") {
      loadStore();
      if (!memoryStore[tableName]) memoryStore[tableName] = {};
      const tableData = memoryStore[tableName];
      const docsData = Object.values(tableData).map((d: any) => ({ ...convertTimestamps(d), id: d.id, _tableName: tableName }));
      
      const ctx = appContext.getStore();
      const tenantId = ctx?.tenantId;
      const isFullAdmin = ctx?.isFullAdmin;

      const updated = [];
      const cleanedUpdate = removeUndefined(this.data);
      for (const docData of docsData) {
        if (!isFullAdmin && tenantId && tableName !== "roles") {
          if (docData.tenantId && docData.tenantId !== tenantId) {
             continue;
          }
        }
        const matchFilter = this.conditions.every((c) => evaluateSingleCondition(docData, c));`;

code = code.replace(targetUpdate, replaceUpdate);

const targetDelete = `    if (this.action === "delete") {
      loadStore();
      if (!memoryStore[tableName]) memoryStore[tableName] = {};
      const tableData = memoryStore[tableName];
      const docsData = Object.values(tableData).map((d: any) => ({ ...convertTimestamps(d), id: d.id, _tableName: tableName }));

      const deleted = [];
      for (const docData of docsData) {
        const matchFilter = this.conditions.every((c) => evaluateSingleCondition(docData, c));`;

const replaceDelete = `    if (this.action === "delete") {
      loadStore();
      if (!memoryStore[tableName]) memoryStore[tableName] = {};
      const tableData = memoryStore[tableName];
      const docsData = Object.values(tableData).map((d: any) => ({ ...convertTimestamps(d), id: d.id, _tableName: tableName }));
      
      const ctx = appContext.getStore();
      const tenantId = ctx?.tenantId;
      const isFullAdmin = ctx?.isFullAdmin;

      const deleted = [];
      for (const docData of docsData) {
        if (!isFullAdmin && tenantId && tableName !== "roles") {
          if (docData.tenantId && docData.tenantId !== tenantId) {
             continue;
          }
        }
        const matchFilter = this.conditions.every((c) => evaluateSingleCondition(docData, c));`;

code = code.replace(targetDelete, replaceDelete);
fs.writeFileSync(file, code);
