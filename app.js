const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const { Router } = require('./lib/router');
const { sessionMiddleware } = require('./lib/session');
const views = require('./lib/views');
const { getDb, nextId, saveDb } = require('./config/database');

const PORT = process.env.PORT || 3000;

// Response helpers
function enhanceResponse(res) {
  res.redirect = (loc) => { res.writeHead(302, { Location: loc }); res.end(); };
  res.html = (code, body) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(body); };
}

function getUserPermissions(userID) {
  const db = getDb();
  const roleIds = db.LnkUserRole.filter(ur => ur.userID === userID).map(ur => ur.RoleID);
  const permIds = new Set();
  roleIds.forEach(rid => db.lnkRolePermission.filter(rp => rp.RoleID === rid).forEach(rp => permIds.add(rp.PermissionID)));
  return db.Permissions.filter(p => permIds.has(p.PermissionID)).map(p => p.PermissionDescription);
}

function getUserRoles(userID) {
  const db = getDb();
  const roleIds = db.LnkUserRole.filter(ur => ur.userID === userID).map(ur => ur.RoleID);
  return db.Roles.filter(r => roleIds.includes(r.RoleID));
}

const router = new Router();
router.use(sessionMiddleware);

// Load user context
router.use((req, res, next) => {
  if (req.session && req.session.user) {
    req.userRoles = getUserRoles(req.session.user.userID);
    req.userPermissions = getUserPermissions(req.session.user.userID);
    req.isAdmin = req.userRoles.some(r => r.IsSysAdmin);
  }
  next();
});

function getFlash(req) { const f = req.session._flash || {}; delete req.session._flash; return f; }
function setFlash(req, type, msg) { req.session._flash = { [type]: msg }; }
function vd(req, extra = {}) {
  return { user: req.session.user || null, roles: req.userRoles || [], permissions: req.userPermissions || [],
    isAdmin: req.isAdmin || false, flash: getFlash(req), ...extra };
}
function auth(req, res) { if (!req.session || !req.session.user) { res.redirect('/auth/login'); return false; } return true; }
function perm(req, p) { return (req.userPermissions || []).includes(p); }
function toArr(v) { return Array.isArray(v) ? v : (v ? [v] : []); }

// Fiscal year: Oct-Dec = calendar year + 1, Jan-Sep = calendar year
function getFiscalYear(date) {
  const d = date ? new Date(date) : new Date();
  const month = d.getMonth(); // 0-indexed: 0=Jan, 9=Oct, 10=Nov, 11=Dec
  return month >= 9 ? d.getFullYear() + 1 : d.getFullYear();
}

// NET/COI calculation based on implementation date
// NET = ((12 - (((monthNumber - 10) + 12) % 12)) / 12) * TotalSavings; COI = TotalSavings - NET
// When OneTimeSavings = 'Yes': NET = TotalSavings, COI = 0
function calcNetCoi(totalSavings, implementationDate, oneTimeSavings) {
  if (oneTimeSavings === 'Yes') return { NET: totalSavings, COI: 0 };
  const implDate = implementationDate ? new Date(implementationDate) : new Date();
  const monthNumber = implDate.getMonth() + 1; // 1-12
  const fiscalMonthsElapsed = ((monthNumber - 10) + 12) % 12;
  const net = ((12 - fiscalMonthsElapsed) / 12) * totalSavings;
  const coi = totalSavings - net;
  return { NET: Math.round(net * 100) / 100, COI: Math.round(coi * 100) / 100 };
}

// Recalculate all savings records for a project based on current total spend (for Direct projects)
function recalcProjectSavings(pid, newTotalSpend) {
  const db = getDb();
  db.SavingsSummary.filter(s => s.ProjectID === pid).forEach(s => {
    s.Spend = newTotalSpend;
    if (s.SavingsAmountType === 'Percentage' && s.SavingsAmountValue) {
      s.Savings = newTotalSpend * (s.SavingsAmountValue / 100);
    }
    const { NET, COI } = calcNetCoi(s.Savings, s.ImplementationDate, s.OneTimeSavings);
    s.NET = NET; s.COI = COI;
    s.orig_Spend = newTotalSpend;
    s.orig_Savings = s.Savings;
  });
}

// Get total SSLC spend for a Direct project
function getDirectProjectSpend(pid) {
  const db = getDb();
  return db.ProjectDetails.filter(d => d.ProjectID === pid && d.RecordStatus === 'ACTIVE' && d.SSLCs_ID)
    .reduce((sum, d) => {
      const sslc = db.SSLCs.find(s => s.ID === d.SSLCs_ID);
      return sum + (sslc ? (sslc.BaseSpendVolume || 0) + (sslc.AdjustmentVolume || 0) : 0);
    }, 0);
}

// Get total spend for Indirect/Logistics projects (from savings records)
function getIndirectProjectSpend(pid) {
  const db = getDb();
  const savings = db.SavingsSummary.filter(s => s.ProjectID === pid);
  return savings.length > 0 ? (savings[0].Spend || 0) : 0;
}

// Sync spend across all savings records for Indirect/Logistics projects
function syncIndirectSpend(pid, spend) {
  const db = getDb();
  db.SavingsSummary.filter(s => s.ProjectID === pid).forEach(s => {
    s.Spend = spend;
    if (s.SavingsAmountType === 'Percentage' && s.SavingsAmountValue) {
      s.Savings = spend * (s.SavingsAmountValue / 100);
    }
    const { NET, COI } = calcNetCoi(s.Savings, s.ImplementationDate, s.OneTimeSavings);
    s.NET = NET; s.COI = COI;
  });
}

// ==================== STATIC ====================
router.get('/css/styles.css', (req, res) => {
  try { const c = fs.readFileSync(path.join(__dirname, 'public/css/styles.css'), 'utf8'); res.writeHead(200, {'Content-Type':'text/css'}); res.end(c); }
  catch { res.writeHead(404); res.end(); }
});

// ==================== AUTH ====================
router.get('/auth/login', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/projects');
  res.html(200, views.login({ title: 'Login', error: '', user: null, flash: {} }));
});

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.html(200, views.login({ title: 'Login', error: 'Username and password required.', user: null, flash: {} }));
  const db = getDb();
  const user = db.LoginUser.find(u => u.username === username && !u.Inactive);
  if (!user) return res.html(200, views.login({ title: 'Login', error: 'Invalid credentials.', user: null, flash: {} }));
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash !== user.PasswordHash) return res.html(200, views.login({ title: 'Login', error: 'Invalid credentials.', user: null, flash: {} }));
  req.session.user = { userID: user.userID, username: user.username, DisplayName: user.DisplayName, EMail: user.EMail, roles: getUserRoles(user.userID).map(r => r.RoleDescription) };
  res.redirect('/projects');
});

router.get('/auth/logout', (req, res) => { req.destroySession(); res.redirect('/auth/login'); });
router.get('/', (req, res) => { res.redirect(req.session && req.session.user ? '/projects' : '/auth/login'); });

// ==================== ADMIN: USERS ====================
router.get('/admin/users', (req, res) => {
  if (!auth(req, res) || !req.isAdmin) return;
  const db = getDb();
  const users = db.LoginUser.map(u => {
    const rn = db.LnkUserRole.filter(ur => ur.userID === u.userID).map(rl => (db.Roles.find(r => r.RoleID === rl.RoleID) || {}).RoleDescription).filter(Boolean);
    return { ...u, RoleNames: rn.join(', ') };
  });
  res.html(200, views.userList(vd(req, { title: 'User Management', users })));
});

router.get('/admin/users/create', (req, res) => {
  if (!auth(req, res) || !req.isAdmin) return;
  const db = getDb();
  res.html(200, views.userForm(vd(req, { title: 'Create User', formUser: null, error: '', allRoles: db.Roles, businessUnits: db.Business_Unit, allRegions: db.Region, userRoles: [], userBUs: [], userRegions: [] })));
});

router.post('/admin/users/create', (req, res) => {
  if (!auth(req, res) || !req.isAdmin) return;
  const db = getDb();
  const { username, displayName, email, password, roles, businessUnits, regions } = req.body;
  if (db.LoginUser.find(u => u.username === username))
    return res.html(200, views.userForm(vd(req, { title: 'Create User', formUser: req.body, error: 'Username exists.', allRoles: db.Roles, businessUnits: db.Business_Unit, allRegions: db.Region, userRoles: [], userBUs: [], userRegions: [] })));
  const userId = nextId('LoginUser');
  db.LoginUser.push({ userID: userId, username, DisplayName: displayName, PasswordHash: crypto.createHash('sha256').update(password || 'changeme').digest('hex'), EMail: email, Inactive: 0, LastModified: new Date().toISOString() });
  toArr(roles).forEach(rid => db.LnkUserRole.push({ userID: userId, RoleID: Number(rid) }));
  toArr(businessUnits).forEach(bid => db.LnkUserBusinessUnit.push({ userID: userId, Business_UnitID: Number(bid) }));
  toArr(regions).forEach(rid => db.LnkUserRegion.push({ userID: userId, RegionID: Number(rid) }));
  saveDb(); setFlash(req, 'success', 'User created.'); res.redirect('/admin/users');
});

router.get('/admin/users/:id/edit', (req, res) => {
  if (!auth(req, res) || !req.isAdmin) return;
  const db = getDb();
  const u = db.LoginUser.find(u => u.userID === Number(req.params.id));
  if (!u) return res.redirect('/admin/users');
  res.html(200, views.userForm(vd(req, { title: 'Edit User', formUser: u, error: '', allRoles: db.Roles, businessUnits: db.Business_Unit, allRegions: db.Region,
    userRoles: db.LnkUserRole.filter(ur => ur.userID === u.userID).map(r => r.RoleID),
    userBUs: db.LnkUserBusinessUnit.filter(ub => ub.userID === u.userID).map(r => r.Business_UnitID),
    userRegions: db.LnkUserRegion.filter(ur => ur.userID === u.userID).map(r => r.RegionID) })));
});

router.post('/admin/users/:id/edit', (req, res) => {
  if (!auth(req, res) || !req.isAdmin) return;
  const db = getDb();
  const userId = Number(req.params.id);
  const { displayName, email, password, roles, businessUnits, regions, inactive } = req.body;
  const user = db.LoginUser.find(u => u.userID === userId);
  if (!user) return res.redirect('/admin/users');
  user.DisplayName = displayName; user.EMail = email; user.Inactive = inactive ? 1 : 0; user.LastModified = new Date().toISOString();
  if (password) user.PasswordHash = crypto.createHash('sha256').update(password).digest('hex');
  db.LnkUserRole = db.LnkUserRole.filter(ur => ur.userID !== userId);
  toArr(roles).forEach(rid => db.LnkUserRole.push({ userID: userId, RoleID: Number(rid) }));
  db.LnkUserBusinessUnit = db.LnkUserBusinessUnit.filter(ub => ub.userID !== userId);
  toArr(businessUnits).forEach(bid => db.LnkUserBusinessUnit.push({ userID: userId, Business_UnitID: Number(bid) }));
  db.LnkUserRegion = db.LnkUserRegion.filter(ur => ur.userID !== userId);
  toArr(regions).forEach(rid => db.LnkUserRegion.push({ userID: userId, RegionID: Number(rid) }));
  saveDb(); setFlash(req, 'success', 'User updated.'); res.redirect('/admin/users');
});

router.post('/admin/users/:id/toggle', (req, res) => {
  if (!auth(req, res) || !req.isAdmin) return;
  const db = getDb();
  const user = db.LoginUser.find(u => u.userID === Number(req.params.id));
  if (user) { user.Inactive = user.Inactive ? 0 : 1; saveDb(); }
  setFlash(req, 'success', 'User status changed.'); res.redirect('/admin/users');
});

// ==================== ADMIN: ROLES ====================
router.get('/admin/roles', (req, res) => {
  if (!auth(req, res) || !req.isAdmin) return;
  const db = getDb();
  const roles = db.Roles.map(r => {
    const pn = db.lnkRolePermission.filter(rp => rp.RoleID === r.RoleID).map(pl => (db.Permissions.find(p => p.PermissionID === pl.PermissionID) || {}).PermissionDescription).filter(Boolean);
    return { ...r, PermissionNames: pn.join(', ') };
  });
  res.html(200, views.roleList(vd(req, { title: 'Role Management', roles })));
});

router.get('/admin/roles/:id/edit', (req, res) => {
  if (!auth(req, res) || !req.isAdmin) return;
  const db = getDb();
  const role = db.Roles.find(r => r.RoleID === Number(req.params.id));
  if (!role) return res.redirect('/admin/roles');
  res.html(200, views.roleForm(vd(req, { title: 'Edit Role', role, error: '', allPermissions: db.Permissions,
    rolePerms: db.lnkRolePermission.filter(rp => rp.RoleID === role.RoleID).map(r => r.PermissionID) })));
});

router.post('/admin/roles/:id/edit', (req, res) => {
  if (!auth(req, res) || !req.isAdmin) return;
  const db = getDb();
  const roleId = Number(req.params.id);
  const { roleDescription, permissions } = req.body;
  const role = db.Roles.find(r => r.RoleID === roleId);
  if (role) role.RoleDescription = roleDescription;
  db.lnkRolePermission = db.lnkRolePermission.filter(rp => rp.RoleID !== roleId);
  toArr(permissions).forEach(pid => db.lnkRolePermission.push({ RoleID: roleId, PermissionID: Number(pid) }));
  saveDb(); setFlash(req, 'success', 'Role updated.'); res.redirect('/admin/roles');
});

// ==================== PROJECTS ====================
// NOTE: specific routes BEFORE parameterized routes
router.get('/projects/new/create', (req, res) => {
  if (!auth(req, res)) return;
  if (!perm(req, 'CreateProject')) return res.html(403, 'Access denied');
  const db = getDb();
  res.html(200, views.projectForm(vd(req, { title: 'Create Project', project: null, error: '',
    projectTypes: db.ProjectType, commodityTypes: db.Commodity_Type, statuses: db.Project_Status,
    fiscalYears: db.FiscalYear.slice().sort((a, b) => b.Fiscal_Year - a.Fiscal_Year) })));
});

router.post('/projects/new/create', (req, res) => {
  if (!auth(req, res) || !perm(req, 'CreateProject')) return;
  const db = getDb();
  const { projectTypeID, commodityTypeID, projectName, projectOwner, projectStartDate, comments, corporateLed, referenceID, currentDPO, futureDPO, fiscalYear, esProjectNumber } = req.body;
  const hid = nextId('ProjectHeader');
  db.ProjectHeader.push({ ID: hid, ProjectTypeID: Number(projectTypeID), SCSCommodity_TypeID: Number(commodityTypeID),
    ProjectName: projectName, ProjectOwner: projectOwner || req.session.user.username, ProjectStartDate: projectStartDate,
    Comments: comments, CorporateLed: corporateLed, ReferenceID: referenceID,
    CurrentDPO: currentDPO ? Number(currentDPO) : null, FutureDPO: futureDPO ? Number(futureDPO) : null,
    RequestedBy: req.session.user.username, RequestedDate: new Date().toISOString(), UpdatedBy: req.session.user.username, InsertedAt: new Date().toISOString() });
  const pid = nextId('ProjectSummary');
  db.ProjectSummary.push({ ProjectID: pid, ProjectHeaderID: hid, ESProjectNumber: esProjectNumber || null,
    ProjectStatusID: 1, UpdatedBy: req.session.user.username, RecordStatus: 'ACTIVE',
    FiscalYear: Number(fiscalYear) || getFiscalYear(), IsLocked: 0, InsertedAt: new Date().toISOString() });
  saveDb(); setFlash(req, 'success', 'Project created.'); res.redirect('/projects/' + pid);
});

router.get('/projects/archive/list', (req, res) => {
  if (!auth(req, res)) return;
  const db = getDb();
  const as = db.Project_Status.find(s => s.Name === 'Archived');
  let projects = [];
  if (as) {
    projects = db.ProjectSummary.filter(ps => ps.ProjectStatusID === as.Project_StatusID && ps.RecordStatus === 'ACTIVE')
      .map(ps => { const ph = db.ProjectHeader.find(h => h.ID === ps.ProjectHeaderID) || {}; const pt = db.ProjectType.find(t => t.ProjectTypeID === ph.ProjectTypeID) || {};
        return { ...ps, ...ph, ProjectTypeName: pt.ProjectTypeName, StatusName: 'Archived' }; });
  }
  res.html(200, views.archivedProjects(vd(req, { title: 'Archived Projects', projects })));
});

router.get('/projects', (req, res) => {
  if (!auth(req, res)) return;
  const db = getDb();
  const { status, search, projectType, fiscalYear } = req.query;
  let projects = db.ProjectSummary.filter(ps => ps.RecordStatus === 'ACTIVE').map(ps => {
    const ph = db.ProjectHeader.find(h => h.ID === ps.ProjectHeaderID) || {};
    const pt = db.ProjectType.find(t => t.ProjectTypeID === ph.ProjectTypeID) || {};
    const ct = db.Commodity_Type.find(c => c.Commodity_TypeID === ph.SCSCommodity_TypeID) || {};
    const pst = db.Project_Status.find(s => s.Project_StatusID === ps.ProjectStatusID) || {};
    const sav = db.SavingsSummary.filter(s => s.ProjectID === ps.ProjectID);
    return { ...ps, ...ph, ProjectTypeName: pt.ProjectTypeName, Commodity_TypeName: ct.Commodity_TypeName, StatusName: pst.Name,
      TotalSpend: sav.reduce((s, v) => s + (v.Spend || 0), 0), TotalSavings: sav.reduce((s, v) => s + (v.Savings || 0), 0) };
  });
  if (status && status !== 'all') projects = projects.filter(p => p.StatusName === status);
  else projects = projects.filter(p => p.StatusName !== 'Archived');
  if (search) { const s = search.toLowerCase(); projects = projects.filter(p => (p.ProjectName||'').toLowerCase().includes(s) || (p.ESProjectNumber||'').toLowerCase().includes(s) || (p.ProjectOwner||'').toLowerCase().includes(s)); }
  if (projectType) projects = projects.filter(p => p.ProjectTypeID === Number(projectType));
  if (fiscalYear) projects = projects.filter(p => p.FiscalYear === Number(fiscalYear));
  projects.sort((a, b) => b.ProjectID - a.ProjectID);
  res.html(200, views.projectList(vd(req, { title: 'Projects', projects, filters: req.query,
    projectTypes: db.ProjectType, statuses: db.Project_Status.filter(s => s.Name !== 'Archived'),
    fiscalYears: db.FiscalYear.slice().sort((a, b) => b.Fiscal_Year - a.Fiscal_Year) })));
});

router.get('/projects/:id/edit', (req, res) => {
  if (!auth(req, res) || !perm(req, 'EditProject')) return;
  const db = getDb();
  const ps = db.ProjectSummary.find(p => p.ProjectID === Number(req.params.id));
  if (!ps) return res.html(404, 'Not found');
  const ph = db.ProjectHeader.find(h => h.ID === ps.ProjectHeaderID) || {};
  res.html(200, views.projectForm(vd(req, { title: 'Edit Project', project: { ...ps, ...ph }, error: '',
    projectTypes: db.ProjectType, commodityTypes: db.Commodity_Type, statuses: db.Project_Status,
    fiscalYears: db.FiscalYear.slice().sort((a, b) => b.Fiscal_Year - a.Fiscal_Year) })));
});

router.post('/projects/:id/edit', (req, res) => {
  if (!auth(req, res) || !perm(req, 'EditProject')) return;
  const db = getDb();
  const pid = Number(req.params.id);
  const ps = db.ProjectSummary.find(p => p.ProjectID === pid);
  if (!ps) return res.html(404, 'Not found');
  const ph = db.ProjectHeader.find(h => h.ID === ps.ProjectHeaderID);
  const { projectTypeID, commodityTypeID, projectName, projectOwner, projectStartDate, comments, corporateLed, referenceID, currentDPO, futureDPO, statusID, fiscalYear, esProjectNumber } = req.body;
  if (ph) Object.assign(ph, { ProjectTypeID: Number(projectTypeID), SCSCommodity_TypeID: Number(commodityTypeID), ProjectName: projectName, ProjectOwner: projectOwner, ProjectStartDate: projectStartDate, Comments: comments, CorporateLed: corporateLed, ReferenceID: referenceID, CurrentDPO: currentDPO ? Number(currentDPO) : null, FutureDPO: futureDPO ? Number(futureDPO) : null, UpdatedBy: req.session.user.username, UpdateDate: new Date().toISOString() });
  Object.assign(ps, { ProjectStatusID: Number(statusID) || ps.ProjectStatusID, ESProjectNumber: esProjectNumber, FiscalYear: Number(fiscalYear), UpdatedBy: req.session.user.username, UpdateDate: new Date().toISOString() });
  saveDb(); setFlash(req, 'success', 'Project updated.'); res.redirect('/projects/' + pid);
});

router.get('/projects/:id/savings/add', (req, res) => {
  if (!auth(req, res) || !perm(req, 'AddSavings')) return;
  const db = getDb();
  const pid = Number(req.params.id);
  const ps = db.ProjectSummary.find(p => p.ProjectID === pid);
  if (!ps) return res.html(404, 'Not found');
  const ph = db.ProjectHeader.find(h => h.ID === ps.ProjectHeaderID) || {};
  const isDirect = ph.SCSCommodity_TypeID === 2;
  const directSpend = isDirect ? getDirectProjectSpend(pid) : 0;
  res.html(200, views.savingsForm(vd(req, { title: 'Add Savings', project: { ...ps, ...ph }, error: '', directSpend })));
});

router.post('/projects/:id/savings/add', (req, res) => {
  if (!auth(req, res) || !perm(req, 'AddSavings')) return;
  const db = getDb();
  const pid = Number(req.params.id);
  const ps = db.ProjectSummary.find(p => p.ProjectID === pid);
  const ph = ps ? db.ProjectHeader.find(h => h.ID === ps.ProjectHeaderID) : null;
  const isDirect = ph && ph.SCSCommodity_TypeID === 2;
  const { spend, savingsAmountType, savingsAmountValue, savings, remarks, additionalSavingsConsiderations, implementationDate, exhibit, oneTimeSavings } = req.body;

  let spendVal;
  if (isDirect) {
    // Direct: spend comes from linked SSLCs
    spendVal = getDirectProjectSpend(pid);
  } else {
    // Indirect/Logistics: spend is manually entered and synced across all savings records
    spendVal = parseFloat(spend) || 0;
  }

  let calcSavings = savingsAmountType === 'Percentage' && savingsAmountValue ? spendVal * (parseFloat(savingsAmountValue) / 100) : (parseFloat(savingsAmountValue || savings) || 0);
  const { NET, COI } = calcNetCoi(calcSavings, implementationDate, oneTimeSavings);

  db.SavingsSummary.push({ SavingsID: nextId('SavingsSummary'), Spend: spendVal, SavingsAmountType: savingsAmountType,
    SavingsAmountValue: savingsAmountValue ? parseFloat(savingsAmountValue) : null, Savings: calcSavings, Remarks: remarks,
    Status: 'Pending', NET, COI, ProjectID: pid, UpdatedBy: req.session.user.username,
    AdditionalSavingsConsiderations: additionalSavingsConsiderations, ImplementationDate: implementationDate,
    Exhibit: exhibit, OneTimeSavings: oneTimeSavings, FiscalYear: getFiscalYear(implementationDate),
    orig_Spend: spendVal, orig_Savings: calcSavings, InsertedAt: new Date().toISOString() });

  // For Indirect/Logistics: sync spend across all savings records
  if (!isDirect) {
    syncIndirectSpend(pid, spendVal);
  }

  saveDb(); setFlash(req, 'success', 'Savings added.'); res.redirect('/projects/' + pid);
});

router.post('/projects/:id/archive', (req, res) => {
  if (!auth(req, res) || !perm(req, 'ArchiveProject')) return;
  const db = getDb();
  const as = db.Project_Status.find(s => s.Name === 'Archived');
  const ps = db.ProjectSummary.find(p => p.ProjectID === Number(req.params.id));
  if (ps && as) { ps.ProjectStatusID = as.Project_StatusID; ps.UpdatedBy = req.session.user.username; ps.UpdateDate = new Date().toISOString(); saveDb(); }
  setFlash(req, 'success', 'Project archived.'); res.redirect('/projects');
});

router.post('/projects/:id/unarchive', (req, res) => {
  if (!auth(req, res) || !perm(req, 'ArchiveProject')) return;
  const db = getDb();
  const as = db.Project_Status.find(s => s.Name === 'Active');
  const ps = db.ProjectSummary.find(p => p.ProjectID === Number(req.params.id));
  if (ps && as) { ps.ProjectStatusID = as.Project_StatusID; ps.UpdatedBy = req.session.user.username; ps.UpdateDate = new Date().toISOString(); saveDb(); }
  setFlash(req, 'success', 'Project restored.'); res.redirect('/projects/' + req.params.id);
});

router.post('/projects/:id/details/add', (req, res) => {
  if (!auth(req, res) || !perm(req, 'EditProject')) return;
  const db = getDb();
  const pid = Number(req.params.id);
  const { commodityTeamID, commodityFamilyID, commodityDescID, supplierID, localSupplierID, businessUnitID, regionID, siteID, purchaseTypeID } = req.body;
  // Look up names for display
  const sup = db.Suppliers.find(s => s.SupplierID === Number(supplierID)) || {};
  const cd = db.Commodity_Description.find(c => c.Commodity_DescriptionID === Number(commodityDescID)) || {};
  const bs = db.Business_Sites.find(b => b.SiteID === Number(siteID)) || {};
  db.ProjectDetails.push({ ProjectDetailsID: nextId('ProjectDetails'), ProjectID: pid,
    SCSCommodity_Team_NameID: commodityTeamID ? Number(commodityTeamID) : null, SCSCommodity_FamilyID: commodityFamilyID ? Number(commodityFamilyID) : null,
    SCSCommodity_DescriptionID: commodityDescID ? Number(commodityDescID) : null, Commodity_Code: cd.Code || null, Supplier: sup.SupplierName || null,
    SCSTBusinessUnitID: businessUnitID ? Number(businessUnitID) : null, RegionID: regionID ? Number(regionID) : null,
    SiteID: siteID ? Number(siteID) : null, Site: bs.SiteName || null,
    SupplierID: supplierID ? Number(supplierID) : null, LocalSupplierID: localSupplierID ? Number(localSupplierID) : null,
    PurchaseTypeID: purchaseTypeID ? Number(purchaseTypeID) : null, RecordStatus: 'ACTIVE', InsertedAt: new Date().toISOString() });
  saveDb(); setFlash(req, 'success', 'Detail line added.'); res.redirect('/spend/' + pid + '/details');
});

// Update spend for Indirect/Logistics projects (syncs across all savings records)
router.post('/spend/:projectId/update-spend', (req, res) => {
  if (!auth(req, res) || !perm(req, 'AddSpend')) return;
  const db = getDb();
  const pid = Number(req.params.projectId);
  const ps = db.ProjectSummary.find(p => p.ProjectID === pid);
  const ph = ps ? db.ProjectHeader.find(h => h.ID === ps.ProjectHeaderID) : null;
  if (!ph || ph.SCSCommodity_TypeID === 2) { setFlash(req, 'error', 'Not allowed for Direct projects.'); return res.redirect('/spend/' + pid + '/details'); }
  const spend = parseFloat(req.body.spend) || 0;
  syncIndirectSpend(pid, spend);
  saveDb(); setFlash(req, 'success', 'Spend updated across all savings records.'); res.redirect('/spend/' + pid + '/details');
});

router.post('/projects/:id/details/:detailId/delete', (req, res) => {
  if (!auth(req, res)) return;
  const db = getDb();
  const pid = Number(req.params.id);
  const d = db.ProjectDetails.find(d => d.ProjectDetailsID === Number(req.params.detailId));
  if (d) { d.RecordStatus = 'DELETED'; d.DeleteReason = 'Removed'; saveDb(); }
  setFlash(req, 'success', 'Line removed.'); res.redirect('/spend/' + pid + '/details');
});

router.get('/projects/:id', (req, res) => {
  if (!auth(req, res)) return;
  const db = getDb();
  const ps = db.ProjectSummary.find(p => p.ProjectID === Number(req.params.id));
  if (!ps) return res.html(404, 'Not found');
  const ph = db.ProjectHeader.find(h => h.ID === ps.ProjectHeaderID) || {};
  const pt = db.ProjectType.find(t => t.ProjectTypeID === ph.ProjectTypeID) || {};
  const ct = db.Commodity_Type.find(c => c.Commodity_TypeID === ph.SCSCommodity_TypeID) || {};
  const pst = db.Project_Status.find(s => s.Project_StatusID === ps.ProjectStatusID) || {};
  const project = { ...ps, ...ph, ProjectTypeName: pt.ProjectTypeName, Commodity_TypeName: ct.Commodity_TypeName, StatusName: pst.Name };
  const details = db.ProjectDetails.filter(d => d.ProjectID === ps.ProjectID && d.RecordStatus === 'ACTIVE').map(d => ({
    ...d,
    Commodity_Team_NameDesc: (db.Commodity_Team_Name.find(c => c.Commodity_Team_NameID === d.SCSCommodity_Team_NameID) || {}).Commodity_Team_NameDesc,
    Commodity_FamilyName: (db.Commodity_Family.find(c => c.Commodity_FamilyID === d.SCSCommodity_FamilyID) || {}).Commodity_FamilyName,
    Commodity_DescriptionName: (db.Commodity_Description.find(c => c.Commodity_DescriptionID === d.SCSCommodity_DescriptionID) || {}).Commodity_DescriptionName,
    Business_UnitName: (db.Business_Unit.find(b => b.Business_UnitID === d.SCSTBusinessUnitID) || {}).Business_UnitName,
    RegionName: (db.Region.find(r => r.RegionID === d.RegionID) || {}).RegionName,
    SupplierName: (db.Suppliers.find(s => s.SupplierID === d.SupplierID) || {}).SupplierName,
    SiteName: (db.Business_Sites.find(s => s.SiteID === d.SiteID) || {}).SiteName,
    PurchaseTypeName: (db.PurchaseTypes.find(p => p.PurchaseTypeID === d.PurchaseTypeID) || {}).PurchaseTypeName }));
  const savings = db.SavingsSummary.filter(s => s.ProjectID === ps.ProjectID).sort((a, b) => b.SavingsID - a.SavingsID);
  res.html(200, views.projectView(vd(req, { title: project.ProjectName, project, details, savings })));
});

// ==================== SSLC / SPEND ====================
router.get('/spend/:projectId/sslc', (req, res) => {
  if (!auth(req, res) || !perm(req, 'LinkSSLC')) return;
  const db = getDb();
  const pid = Number(req.params.projectId);
  const ps = db.ProjectSummary.find(p => p.ProjectID === pid);
  if (!ps) return res.html(404, 'Not found');
  const ph = db.ProjectHeader.find(h => h.ID === ps.ProjectHeaderID) || {};
  if (ph.SCSCommodity_TypeID !== 2) { setFlash(req, 'error', 'SSLC linking only for Direct projects.'); return res.redirect('/projects/' + pid); }
  const ct = db.Commodity_Type.find(c => c.Commodity_TypeID === ph.SCSCommodity_TypeID) || {};
  const project = { ...ps, ...ph, Commodity_TypeName: ct.Commodity_TypeName };
  const { supplier, site, commodityDesc, purchaseType, excludeZero } = req.query;
  let sslcs = db.SSLCs.filter(s => { const r = db.SSLC_Rollups.find(r => r.ID === s.SSLC_Rollup_ID); return r && r.IsActive; }).map(s => {
    const ro = db.SSLC_Rollups.find(r => r.ID === s.SSLC_Rollup_ID) || {};
    const bs = db.Business_Sites.find(b => b.SiteID === s.SiteID) || {};
    return { ...s, RollupYear: ro.RollupYear, RollupQuarter: ro.RollupQuarter,
      SiteName: bs.SiteName, SiteCode: bs.SiteCode,
      SupplierName: (db.Suppliers.find(sp => sp.SupplierID === s.SupplierID) || {}).SupplierName,
      LocalSupplierName: (db.LocalSuppliers.find(l => l.LocalSupplierID === s.LocalSupplierID) || {}).LocalSupplierName,
      Commodity_DescriptionName: (db.Commodity_Description.find(c => c.Commodity_DescriptionID === s.Commodity_DescriptionID) || {}).Commodity_DescriptionName,
      CommodityCode: (db.Commodity_Description.find(c => c.Commodity_DescriptionID === s.Commodity_DescriptionID) || {}).Code,
      PurchaseTypeName: (db.PurchaseTypes.find(p => p.PurchaseTypeID === s.PurchaseTypeID) || {}).PurchaseTypeName,
      Business_UnitName: (db.Business_Unit.find(b => b.Business_UnitID === bs.Business_UnitID) || {}).Business_UnitName,
      RegionName: (db.Region.find(r => r.RegionID === bs.RegionID) || {}).RegionName,
      TotalSpend: (s.BaseSpendVolume || 0) + (s.AdjustmentVolume || 0) };
  });
  if (supplier) sslcs = sslcs.filter(s => (s.SupplierName||'').toLowerCase().includes(supplier.toLowerCase()));
  if (site) sslcs = sslcs.filter(s => (s.SiteName||'').toLowerCase().includes(site.toLowerCase()));
  if (commodityDesc) sslcs = sslcs.filter(s => (s.Commodity_DescriptionName||'').toLowerCase().includes(commodityDesc.toLowerCase()));
  if (purchaseType) sslcs = sslcs.filter(s => s.PurchaseTypeID === Number(purchaseType));
  if (excludeZero === '1') sslcs = sslcs.filter(s => s.TotalSpend > 0);
  const linkedSSLCs = db.ProjectDetails.filter(d => d.ProjectID === pid && d.SSLCs_ID && d.RecordStatus === 'ACTIVE').map(d => d.SSLCs_ID);
  res.html(200, views.sslcBrowser(vd(req, { title: 'Link SSLCs', project, sslcs, linkedSSLCs, purchaseTypes: db.PurchaseTypes, filters: req.query })));
});

router.post('/spend/:projectId/sslc/link', (req, res) => {
  if (!auth(req, res) || !perm(req, 'LinkSSLC')) return;
  const db = getDb();
  const pid = Number(req.params.projectId);
  const ps = db.ProjectSummary.find(p => p.ProjectID === pid);
  const ph = ps ? db.ProjectHeader.find(h => h.ID === ps.ProjectHeaderID) : null;
  if (!ph || ph.SCSCommodity_TypeID !== 2) { setFlash(req, 'error', 'Not allowed.'); return res.redirect('/projects/' + pid); }
  const ids = toArr(req.body.sslcIds).map(Number);
  if (!ids.length) { setFlash(req, 'error', 'No SSLCs selected.'); return res.redirect('/spend/' + pid + '/sslc'); }
  let totalSpend = 0, linked = 0;
  ids.forEach(sslcId => {
    if (db.ProjectDetails.find(d => d.ProjectID === pid && d.SSLCs_ID === sslcId && d.RecordStatus === 'ACTIVE')) return;
    const sslc = db.SSLCs.find(s => s.ID === sslcId); if (!sslc) return;
    const bs = db.Business_Sites.find(b => b.SiteID === sslc.SiteID) || {};
    const sup = db.Suppliers.find(s => s.SupplierID === sslc.SupplierID) || {};
    const cd = db.Commodity_Description.find(c => c.Commodity_DescriptionID === sslc.Commodity_DescriptionID) || {};
    db.ProjectDetails.push({ ProjectDetailsID: nextId('ProjectDetails'), ProjectID: pid, SSLCs_ID: sslcId,
      SCSCommodity_DescriptionID: sslc.Commodity_DescriptionID, Commodity_Code: cd.Code, Supplier: sup.SupplierName,
      SCSTBusinessUnitID: bs.Business_UnitID || 1, RegionID: bs.RegionID || 1, SiteID: sslc.SiteID, Site: bs.SiteName,
      SupplierID: sslc.SupplierID, LocalSupplierID: sslc.LocalSupplierID, PurchaseTypeID: sslc.PurchaseTypeID,
      RecordStatus: 'ACTIVE', InsertedAt: new Date().toISOString() });
    totalSpend += (sslc.BaseSpendVolume || 0) + (sslc.AdjustmentVolume || 0); linked++;
  });
  // Recalculate total spend from all linked SSLCs and update all savings records
  const newTotalSpend = getDirectProjectSpend(pid);
  recalcProjectSavings(pid, newTotalSpend);
  saveDb(); setFlash(req, 'success', `${linked} SSLC(s) linked. Total Spend: $${newTotalSpend.toLocaleString()}.`); res.redirect('/projects/' + pid);
});

router.post('/spend/:projectId/sslc/:sslcId/unlink', (req, res) => {
  if (!auth(req, res)) return;
  const db = getDb();
  const pid = Number(req.params.projectId);
  const d = db.ProjectDetails.find(d => d.ProjectID === pid && d.SSLCs_ID === Number(req.params.sslcId) && d.RecordStatus === 'ACTIVE');
  if (d) {
    d.RecordStatus = 'DELETED';
    // Recalculate total spend and update all savings records
    const newTotalSpend = getDirectProjectSpend(pid);
    recalcProjectSavings(pid, newTotalSpend);
    saveDb();
  }
  setFlash(req, 'success', 'SSLC unlinked.'); res.redirect('/projects/' + req.params.projectId);
});

router.get('/spend/:projectId/details', (req, res) => {
  if (!auth(req, res)) return;
  const db = getDb();
  const pid = Number(req.params.projectId);
  const ps = db.ProjectSummary.find(p => p.ProjectID === pid);
  if (!ps) return res.html(404, 'Not found');
  const ph = db.ProjectHeader.find(h => h.ID === ps.ProjectHeaderID) || {};
  const ct = db.Commodity_Type.find(c => c.Commodity_TypeID === ph.SCSCommodity_TypeID) || {};
  const isDirect = ph.SCSCommodity_TypeID === 2;
  const project = { ...ps, ...ph, Commodity_TypeName: ct.Commodity_TypeName };
  const details = db.ProjectDetails.filter(d => d.ProjectID === pid && d.RecordStatus === 'ACTIVE').map(d => {
    const sslc = d.SSLCs_ID ? db.SSLCs.find(s => s.ID === d.SSLCs_ID) : null;
    return { ...d, BaseSpendVolume: sslc ? sslc.BaseSpendVolume : 0, AdjustmentVolume: sslc ? sslc.AdjustmentVolume : 0,
      SSLCTotalSpend: sslc ? (sslc.BaseSpendVolume||0) + (sslc.AdjustmentVolume||0) : 0,
      Commodity_DescriptionName: (db.Commodity_Description.find(c => c.Commodity_DescriptionID === d.SCSCommodity_DescriptionID) || {}).Commodity_DescriptionName,
      CommodityCode: (db.Commodity_Description.find(c => c.Commodity_DescriptionID === d.SCSCommodity_DescriptionID) || {}).Code,
      SupplierName: (db.Suppliers.find(s => s.SupplierID === d.SupplierID) || {}).SupplierName,
      SiteName: (db.Business_Sites.find(s => s.SiteID === d.SiteID) || {}).SiteName,
      Business_UnitName: (db.Business_Unit.find(b => b.Business_UnitID === d.SCSTBusinessUnitID) || {}).Business_UnitName,
      RegionName: (db.Region.find(r => r.RegionID === d.RegionID) || {}).RegionName,
      PurchaseTypeName: (db.PurchaseTypes.find(p => p.PurchaseTypeID === d.PurchaseTypeID) || {}).PurchaseTypeName };
  });
  const savings = db.SavingsSummary.filter(s => s.ProjectID === pid).sort((a, b) => b.SavingsID - a.SavingsID);
  // Direct: spend from SSLCs; Indirect/Logistics: spend from savings records
  const totalSpend = isDirect ? details.reduce((s, d) => s + (d.SSLCTotalSpend||0), 0) : getIndirectProjectSpend(pid);
  const totalSavings = savings.reduce((s, v) => s + (v.Savings||0), 0);
  // For Indirect/Logistics projects, provide dropdown data for adding detail lines
  const extraData = {};
  if (!isDirect) {
    extraData.commodityTeams = db.Commodity_Team_Name;
    extraData.commodityFamilies = db.Commodity_Family;
    extraData.commodityDescriptions = db.Commodity_Description;
    extraData.suppliers = db.Suppliers;
    extraData.localSuppliers = db.LocalSuppliers;
    extraData.businessUnits = db.Business_Unit;
    extraData.regions = db.Region;
    extraData.sites = db.Business_Sites;
    extraData.purchaseTypes = db.PurchaseTypes;
  }
  res.html(200, views.spendDetails(vd(req, { title: 'Spend & Savings', project, details, savings, totalSpend, totalSavings, isDirect, ...extraData })));
});

// ==================== SERVER ====================
const server = http.createServer(async (req, res) => {
  enhanceResponse(res);
  try {
    const handled = await router.handle(req, res);
    if (!handled) {
      const fp = path.join(__dirname, 'public', url.parse(req.url).pathname);
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        const types = { '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' };
        res.writeHead(200, { 'Content-Type': types[path.extname(fp)] || 'application/octet-stream' });
        fs.createReadStream(fp).pipe(res);
      } else {
        res.html(404, views.error({ title: 'Not Found', message: 'Page not found.', user: null, flash: {}, permissions: [], isAdmin: false }));
      }
    }
  } catch (err) {
    console.error('Error:', err);
    if (!res.headersSent) res.html(500, '<h1>Server Error</h1><pre>' + err.stack + '</pre>');
  }
});

server.listen(PORT, () => console.log(`SCST running on http://localhost:${PORT}`));
