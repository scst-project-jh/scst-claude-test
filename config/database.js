const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
let db = null;

function getDb() {
  if (!db) {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    if (fs.existsSync(DB_PATH)) {
      db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } else {
      db = createEmptyDb();
      saveDb();
    }
  }
  return db;
}

function saveDb() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function createEmptyDb() {
  return {
    _counters: {},
    Roles: [],
    Permissions: [],
    lnkRolePermission: [],
    LoginUser: [],
    LnkUserRole: [],
    Business_Group: [],
    Business_Segment: [],
    Business_Unit: [],
    Region: [],
    Business_Sites: [],
    Commodity_Type: [],
    Commodity_Team_Name: [],
    Commodity_Family: [],
    Commodity_Description: [],
    Suppliers: [],
    LocalSuppliers: [],
    PurchaseTypes: [],
    ProjectType: [],
    Project_Status: [],
    FiscalYear: [],
    ProjectHeader: [],
    ProjectSummary: [],
    ProjectDetails: [],
    SavingsSummary: [],
    ProjectSavingsDetails: [],
    SSLC_Rollups: [],
    SSLCs: [],
    LnkUserBusinessUnit: [],
    LnkUserRegion: [],
    LnkUserCommodity: [],
    LnkUserProjectType: []
  };
}

function nextId(table) {
  if (!db._counters[table]) db._counters[table] = 0;
  db._counters[table]++;
  return db._counters[table];
}

function insert(table, record) {
  getDb();
  db[table].push(record);
  saveDb();
  return record;
}

function findAll(table, predicate) {
  const data = getDb();
  if (!predicate) return data[table] || [];
  return (data[table] || []).filter(predicate);
}

function findOne(table, predicate) {
  return (getDb()[table] || []).find(predicate) || null;
}

function update(table, predicate, updates) {
  getDb();
  const arr = db[table] || [];
  let updated = 0;
  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) {
      Object.assign(arr[i], updates);
      updated++;
    }
  }
  if (updated) saveDb();
  return updated;
}

function remove(table, predicate) {
  getDb();
  const before = db[table].length;
  db[table] = db[table].filter(r => !predicate(r));
  if (db[table].length !== before) saveDb();
  return before - db[table].length;
}

module.exports = { getDb, saveDb, nextId, insert, findAll, findOne, update, remove };
