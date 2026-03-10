const { e, formatMoney, layout, statusBadge, roleBadge, selected, checked, checkedInArray } = require('./template');

// Wrap body in layout
function page(data, bodyHtml) {
  return layout(data.title, data.user, data.flash, data.isAdmin, data.permissions, bodyHtml);
}

function hasPerm(data, perm) { return (data.permissions || []).includes(perm); }

// ==================== LOGIN ====================
exports.login = (data) => page(data, `
<div class="row justify-content-center mt-5">
  <div class="col-md-4">
    <div class="card shadow">
      <div class="card-header bg-dark text-white text-center">
        <h4><i class="bi bi-bar-chart-line"></i> SCST Login</h4>
        <small>Supply Chain Savings Tracker</small>
      </div>
      <div class="card-body">
        ${data.error ? `<div class="alert alert-danger">${e(data.error)}</div>` : ''}
        <form method="POST" action="/auth/login">
          <div class="mb-3"><label class="form-label">Username</label><input type="text" class="form-control" name="username" required autofocus></div>
          <div class="mb-3"><label class="form-label">Password</label><input type="password" class="form-control" name="password" required></div>
          <button type="submit" class="btn btn-primary w-100">Sign In</button>
        </form>
      </div>
    </div>
  </div>
</div>`);

// ==================== ERROR ====================
exports.error = (data) => page(data, `
<div class="row justify-content-center mt-5">
  <div class="col-md-6 text-center">
    <h1 class="display-4 text-danger"><i class="bi bi-exclamation-triangle"></i></h1>
    <h2>${e(data.title)}</h2>
    <p class="text-muted">${e(data.message)}</p>
    <a href="/projects" class="btn btn-primary">Go to Projects</a>
  </div>
</div>`);

// ==================== PROJECTS LIST ====================
exports.projectList = (data) => {
  const { projects, filters = {}, projectTypes = [], statuses = [], fiscalYears = [] } = data;
  const rows = projects.map(p => `<tr>
    <td><a href="/projects/${p.ProjectID}">${e(p.ESProjectNumber || '-')}</a></td>
    <td><a href="/projects/${p.ProjectID}">${e(p.ProjectName)}</a></td>
    <td>${e(p.ProjectTypeName)}</td>
    <td><span class="badge bg-${p.SCSCommodity_TypeID === 2 ? 'info' : 'secondary'}">${e(p.Commodity_TypeName)}</span></td>
    <td>${e(p.ProjectOwner)}</td>
    <td>${e(p.ProjectStartDate || '-')}</td>
    <td>${e(p.FiscalYear || '-')}</td>
    <td>${statusBadge(p.StatusName)}</td>
    <td class="text-end">${p.TotalSpend ? formatMoney(p.TotalSpend) : '-'}</td>
    <td class="text-end">${p.TotalSavings ? formatMoney(p.TotalSavings) : '-'}</td>
    <td>
      <div class="btn-group btn-group-sm">
        <a href="/projects/${p.ProjectID}" class="btn btn-outline-primary" title="View"><i class="bi bi-eye"></i></a>
        ${hasPerm(data, 'EditProject') ? `<a href="/projects/${p.ProjectID}/edit" class="btn btn-outline-secondary" title="Edit"><i class="bi bi-pencil"></i></a>` : ''}
        ${p.SCSCommodity_TypeID === 2 && hasPerm(data, 'LinkSSLC') ? `<a href="/spend/${p.ProjectID}/sslc" class="btn btn-outline-info" title="Link SSLCs"><i class="bi bi-link-45deg"></i></a>` : ''}
      </div>
    </td>
  </tr>`).join('');

  return page(data, `
<div class="d-flex justify-content-between align-items-center mb-3">
  <h3><i class="bi bi-folder2-open"></i> Projects</h3>
  ${hasPerm(data, 'CreateProject') ? '<a href="/projects/new/create" class="btn btn-primary"><i class="bi bi-plus-lg"></i> New Project</a>' : ''}
</div>
<div class="card mb-3"><div class="card-body py-2">
  <form method="GET" action="/projects" class="row g-2 align-items-end">
    <div class="col-md-3"><input type="text" class="form-control form-control-sm" name="search" placeholder="Search name, ES#, owner..." value="${e(filters.search || '')}"></div>
    <div class="col-md-2"><select class="form-select form-select-sm" name="status">
      <option value="all" ${selected(filters.status, 'all')}>All Statuses</option>
      ${statuses.map(s => `<option value="${e(s.Name)}" ${selected(filters.status, s.Name)}>${e(s.Name)}</option>`).join('')}
    </select></div>
    <div class="col-md-2"><select class="form-select form-select-sm" name="projectType">
      <option value="">All Types</option>
      ${projectTypes.map(pt => `<option value="${pt.ProjectTypeID}" ${selected(filters.projectType, pt.ProjectTypeID)}>${e(pt.ProjectTypeName)}</option>`).join('')}
    </select></div>
    <div class="col-md-2"><select class="form-select form-select-sm" name="fiscalYear">
      <option value="">All Years</option>
      ${fiscalYears.map(fy => `<option value="${fy.Fiscal_Year}" ${selected(filters.fiscalYear, fy.Fiscal_Year)}>${fy.Fiscal_Year}</option>`).join('')}
    </select></div>
    <div class="col-md-2"><button type="submit" class="btn btn-sm btn-outline-primary">Filter</button> <a href="/projects" class="btn btn-sm btn-outline-secondary">Clear</a></div>
  </form>
</div></div>
<div class="table-responsive"><table class="table table-hover table-sm">
  <thead class="table-dark"><tr><th>ES#</th><th>Project Name</th><th>Type</th><th>Commodity</th><th>Owner</th><th>Start Date</th><th>FY</th><th>Status</th><th class="text-end">Spend</th><th class="text-end">Savings</th><th>Actions</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="11" class="text-center text-muted py-4">No projects found.</td></tr>'}</tbody>
</table></div>`);
};

// ==================== PROJECT VIEW ====================
exports.projectView = (data) => {
  const { project: p, details, savings } = data;
  const detailRows = details.map(d => `<tr>
    <td>${e(d.Commodity_Team_NameDesc || '-')}</td><td>${e(d.Commodity_FamilyName || '-')}</td>
    <td>${e(d.Commodity_DescriptionName || '-')}</td><td>${e(d.Commodity_Code || '-')}</td>
    <td>${e(d.SupplierName || d.Supplier || '-')}</td><td>${e(d.Business_UnitName || '-')}</td>
    <td>${e(d.RegionName || '-')}</td><td>${e(d.SiteName || d.Site || '-')}</td>
    <td>${e(d.PurchaseTypeName || '-')}</td>
    ${hasPerm(data, 'EditProject') ? `<td><form method="POST" action="/projects/${p.ProjectID}/details/${d.ProjectDetailsID}/delete" onsubmit="return confirm('Remove?')"><button type="submit" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button></form></td>` : ''}
  </tr>`).join('');

  const savingsRows = savings.map(s => `<tr>
    <td>${formatMoney(s.Spend)}</td><td class="text-success">${formatMoney(s.Savings)}</td>
    <td>${formatMoney(s.NET)}</td><td>${formatMoney(s.COI)}</td>
    <td>${statusBadge(s.Status)}</td><td>${e(s.ImplementationDate || '-')}</td>
  </tr>`).join('');

  return page(data, `
<div class="d-flex justify-content-between align-items-center mb-3">
  <div><h3>${e(p.ProjectName)}</h3>${statusBadge(p.StatusName)} <span class="text-muted">ES#: ${e(p.ESProjectNumber || 'Not Assigned')}</span></div>
  <div class="btn-group">
    <a href="/projects" class="btn btn-outline-secondary"><i class="bi bi-arrow-left"></i> Back</a>
    ${hasPerm(data, 'EditProject') ? `<a href="/projects/${p.ProjectID}/edit" class="btn btn-outline-primary"><i class="bi bi-pencil"></i> Edit</a>` : ''}
    ${p.SCSCommodity_TypeID === 2 && hasPerm(data, 'LinkSSLC') ? `<a href="/spend/${p.ProjectID}/sslc" class="btn btn-outline-info"><i class="bi bi-link-45deg"></i> Link SSLCs</a>` : ''}
    <a href="/spend/${p.ProjectID}/details" class="btn btn-outline-success"><i class="bi bi-currency-dollar"></i> Spend &amp; Savings</a>
    ${hasPerm(data, 'AddSavings') ? `<a href="/projects/${p.ProjectID}/savings/add" class="btn btn-outline-warning"><i class="bi bi-plus-circle"></i> Add Savings</a>` : ''}
    ${p.StatusName !== 'Archived' && hasPerm(data, 'ArchiveProject') ? `<form method="POST" action="/projects/${p.ProjectID}/archive" class="d-inline" onsubmit="return confirm('Archive this project?')"><button class="btn btn-outline-dark"><i class="bi bi-archive"></i> Archive</button></form>` : ''}
    ${p.StatusName === 'Archived' && hasPerm(data, 'ArchiveProject') ? `<form method="POST" action="/projects/${p.ProjectID}/unarchive" class="d-inline"><button class="btn btn-outline-success"><i class="bi bi-arrow-counterclockwise"></i> Restore</button></form>` : ''}
  </div>
</div>
<div class="row mb-3">
  <div class="col-md-6"><div class="card"><div class="card-header"><strong>Project Information</strong></div><div class="card-body">
    <table class="table table-sm mb-0">
      <tr><th style="width:35%">Project Type</th><td>${e(p.ProjectTypeName)}</td></tr>
      <tr><th>Commodity Type</th><td><span class="badge bg-${p.SCSCommodity_TypeID === 2 ? 'info' : 'secondary'}">${e(p.Commodity_TypeName)}</span></td></tr>
      <tr><th>Owner</th><td>${e(p.ProjectOwner || '-')}</td></tr>
      <tr><th>Start Date</th><td>${e(p.ProjectStartDate || '-')}</td></tr>
      <tr><th>Fiscal Year</th><td>${e(p.FiscalYear || '-')}</td></tr>
      <tr><th>Corporate Led</th><td>${e(p.CorporateLed || '-')}</td></tr>
      <tr><th>Reference ID</th><td>${e(p.ReferenceID || '-')}</td></tr>
      ${p.CurrentDPO || p.FutureDPO ? `<tr><th>Current DPO</th><td>${e(p.CurrentDPO || '-')}</td></tr><tr><th>Future DPO</th><td>${e(p.FutureDPO || '-')}</td></tr>` : ''}
      <tr><th>Comments</th><td>${e(p.Comments || '-')}</td></tr>
    </table>
  </div></div></div>
  <div class="col-md-6">
    <div class="card mb-3"><div class="card-header"><strong>Savings Summary</strong></div><div class="card-body">
      ${savings.length === 0 ? '<p class="text-muted mb-0">No savings records yet.</p>' :
        `<table class="table table-sm mb-0"><thead><tr><th>Spend</th><th>Savings</th><th>NET</th><th>COI</th><th>Status</th><th>Date</th></tr></thead><tbody>${savingsRows}</tbody></table>`}
    </div></div>
    <div class="card"><div class="card-header"><strong>Audit Trail</strong></div><div class="card-body">
      <table class="table table-sm mb-0">
        <tr><th>Requested By</th><td>${e(p.RequestedBy || '-')}</td></tr>
        <tr><th>Updated By</th><td>${e(p.UpdatedBy || '-')}</td></tr>
      </table>
    </div></div>
  </div>
</div>
<div class="card mb-3"><div class="card-header"><strong>Project Detail Lines</strong></div>
  <div class="card-body p-0">
    ${details.length === 0 ? '<p class="text-muted text-center py-3 mb-0">No detail lines yet.</p>' :
      `<div class="table-responsive"><table class="table table-sm table-hover mb-0">
        <thead class="table-light"><tr><th>Commodity Team</th><th>Family</th><th>Description</th><th>Code</th><th>Supplier</th><th>BU</th><th>Region</th><th>Site</th><th>Purchase Type</th>${hasPerm(data, 'EditProject') ? '<th></th>' : ''}</tr></thead>
        <tbody>${detailRows}</tbody></table></div>`}
  </div>
</div>`);
};

// ==================== PROJECT FORM ====================
exports.projectForm = (data) => {
  const { project: p, projectTypes = [], commodityTypes = [], statuses = [], fiscalYears = [] } = data;
  const isEdit = !!p;
  return page(data, `
<div class="d-flex justify-content-between align-items-center mb-3">
  <h3>${isEdit ? 'Edit Project' : 'Create Project'}</h3>
  <a href="${isEdit ? '/projects/' + p.ProjectID : '/projects'}" class="btn btn-outline-secondary"><i class="bi bi-arrow-left"></i> Back</a>
</div>
${data.error ? `<div class="alert alert-danger">${e(data.error)}</div>` : ''}
<form method="POST" action="${isEdit ? '/projects/' + p.ProjectID + '/edit' : '/projects/new/create'}">
  <div class="card mb-3"><div class="card-header"><strong>Project Information</strong></div><div class="card-body"><div class="row g-3">
    <div class="col-md-6"><label class="form-label">Project Name *</label><input type="text" class="form-control" name="projectName" value="${e(isEdit ? p.ProjectName : '')}" required></div>
    <div class="col-md-3"><label class="form-label">ES Project Number</label><input type="text" class="form-control" name="esProjectNumber" value="${e(isEdit ? p.ESProjectNumber || '' : '')}"></div>
    <div class="col-md-3"><label class="form-label">Project Owner</label><input type="text" class="form-control" name="projectOwner" value="${e(isEdit ? p.ProjectOwner || '' : (data.user ? data.user.username : ''))}"></div>
    <div class="col-md-3"><label class="form-label">Project Type *</label><select class="form-select" name="projectTypeID" required><option value="">Select...</option>${projectTypes.map(pt => `<option value="${pt.ProjectTypeID}" ${isEdit && p.ProjectTypeID == pt.ProjectTypeID ? 'selected' : ''}>${e(pt.ProjectTypeName)}</option>`).join('')}</select></div>
    <div class="col-md-3"><label class="form-label">Commodity Type *</label><select class="form-select" name="commodityTypeID" required><option value="">Select...</option>${commodityTypes.map(ct => `<option value="${ct.Commodity_TypeID}" ${isEdit && p.SCSCommodity_TypeID == ct.Commodity_TypeID ? 'selected' : ''}>${e(ct.Commodity_TypeName)}</option>`).join('')}</select></div>
    <div class="col-md-3"><label class="form-label">Start Date</label><input type="date" class="form-control" name="projectStartDate" value="${e(isEdit && p.ProjectStartDate ? p.ProjectStartDate.split('T')[0] : '')}"></div>
    <div class="col-md-3"><label class="form-label">Fiscal Year</label><select class="form-select" name="fiscalYear">${fiscalYears.map(fy => `<option value="${fy.Fiscal_Year}" ${isEdit && p.FiscalYear == fy.Fiscal_Year ? 'selected' : ''}>${fy.Fiscal_Year}</option>`).join('')}</select></div>
    ${isEdit ? `<div class="col-md-3"><label class="form-label">Status</label><select class="form-select" name="statusID">${statuses.map(s => `<option value="${s.Project_StatusID}" ${p.ProjectStatusID == s.Project_StatusID ? 'selected' : ''}>${e(s.Name)}</option>`).join('')}</select></div>` : ''}
    <div class="col-md-3"><label class="form-label">Corporate Led</label><select class="form-select" name="corporateLed"><option value="">Select...</option><option value="Yes" ${isEdit && p.CorporateLed === 'Yes' ? 'selected' : ''}>Yes</option><option value="No" ${isEdit && p.CorporateLed === 'No' ? 'selected' : ''}>No</option></select></div>
    <div class="col-md-3"><label class="form-label">Reference ID</label><input type="text" class="form-control" name="referenceID" value="${e(isEdit ? p.ReferenceID || '' : '')}"></div>
    <div class="col-md-3"><label class="form-label">Current DPO</label><input type="number" class="form-control" name="currentDPO" value="${e(isEdit ? p.CurrentDPO || '' : '')}"></div>
    <div class="col-md-3"><label class="form-label">Future DPO</label><input type="number" class="form-control" name="futureDPO" value="${e(isEdit ? p.FutureDPO || '' : '')}"></div>
    <div class="col-md-12"><label class="form-label">Comments</label><textarea class="form-control" name="comments" rows="3">${e(isEdit ? p.Comments || '' : '')}</textarea></div>
  </div></div></div>
  <div class="d-flex gap-2"><button type="submit" class="btn btn-primary"><i class="bi bi-check-lg"></i> ${isEdit ? 'Save Changes' : 'Create Project'}</button><a href="${isEdit ? '/projects/' + p.ProjectID : '/projects'}" class="btn btn-outline-secondary">Cancel</a></div>
</form>`);
};

// ==================== ARCHIVED ====================
exports.archivedProjects = (data) => {
  const rows = data.projects.map(p => `<tr>
    <td>${e(p.ESProjectNumber || '-')}</td>
    <td><a href="/projects/${p.ProjectID}">${e(p.ProjectName)}</a></td>
    <td>${e(p.ProjectTypeName)}</td><td>${e(p.ProjectOwner)}</td>
    <td>${e(p.ProjectStartDate || '-')}</td><td>${e(p.FiscalYear || '-')}</td>
    <td><a href="/projects/${p.ProjectID}" class="btn btn-sm btn-outline-primary"><i class="bi bi-eye"></i></a>
      ${hasPerm(data, 'ArchiveProject') ? `<form method="POST" action="/projects/${p.ProjectID}/unarchive" class="d-inline"><button class="btn btn-outline-success btn-sm"><i class="bi bi-arrow-counterclockwise"></i> Restore</button></form>` : ''}</td>
  </tr>`).join('');
  return page(data, `
<div class="d-flex justify-content-between align-items-center mb-3">
  <h3><i class="bi bi-archive"></i> Archived Projects</h3>
  <a href="/projects" class="btn btn-outline-secondary"><i class="bi bi-arrow-left"></i> Back</a>
</div>
<div class="table-responsive"><table class="table table-hover table-sm">
  <thead class="table-dark"><tr><th>ES#</th><th>Project Name</th><th>Type</th><th>Owner</th><th>Start Date</th><th>FY</th><th>Actions</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="7" class="text-center text-muted py-4">No archived projects.</td></tr>'}</tbody>
</table></div>`);
};

// ==================== SAVINGS FORM ====================
exports.savingsForm = (data) => {
  const { project: p } = data;
  const isDirect = p.SCSCommodity_TypeID === 2;
  return page(data, `
<div class="d-flex justify-content-between align-items-center mb-3">
  <h3>Add Savings - ${e(p.ProjectName)}</h3>
  <a href="/projects/${p.ProjectID}" class="btn btn-outline-secondary"><i class="bi bi-arrow-left"></i> Back</a>
</div>
<form method="POST" action="/projects/${p.ProjectID}/savings/add">
  <div class="card mb-3"><div class="card-header"><strong>Savings Information</strong></div><div class="card-body"><div class="row g-3">
    ${isDirect
      ? `<div class="col-md-4"><label class="form-label">Spend ($) - from SSLCs</label><input type="number" step="0.01" class="form-control" name="spend" id="spend" value="${data.directSpend || 0}" readonly></div>`
      : `<div class="col-md-4"><label class="form-label">Spend ($) *</label><input type="number" step="0.01" class="form-control" name="spend" id="spend" required oninput="calcSavings()"></div>`}
    <div class="col-md-4"><label class="form-label">Savings Type *</label><select class="form-select" name="savingsAmountType" id="savingsAmountType" onchange="toggleType()" required><option value="Fixed">Fixed Amount ($)</option><option value="Percentage">Percentage (%)</option></select></div>
    <div class="col-md-4"><label class="form-label" id="svLabel">Savings Amount ($)</label><input type="number" step="0.01" class="form-control" name="savingsAmountValue" id="svValue" oninput="calcSavings()"></div>
    <div class="col-md-4"><label class="form-label">Calculated Savings ($)</label><input type="number" step="0.01" class="form-control" name="savings" id="savings" readonly></div>
    <div class="col-md-4"><label class="form-label">COI ($)</label><input type="number" step="0.01" class="form-control" id="coi" readonly></div>
    <div class="col-md-4"><label class="form-label">NET ($)</label><input type="number" step="0.01" class="form-control" id="net" readonly></div>
    <div class="col-md-4"><label class="form-label">Implementation Date *</label><input type="date" class="form-control" name="implementationDate" id="implDate" required onchange="calcNetCoi()"></div>
    <div class="col-md-4"><label class="form-label">One Time Savings</label><select class="form-select" name="oneTimeSavings" id="oneTimeSavings" onchange="calcNetCoi()"><option value="No">No</option><option value="Yes">Yes</option></select></div>
    <div class="col-md-4"><label class="form-label">Exhibit</label><input type="text" class="form-control" name="exhibit"></div>
    <div class="col-md-6"><label class="form-label">Special Savings Considerations</label><textarea class="form-control" name="additionalSavingsConsiderations" rows="2"></textarea></div>
    <div class="col-md-6"><label class="form-label">Remarks</label><textarea class="form-control" name="remarks" rows="2"></textarea></div>
  </div></div></div>
  <div class="d-flex gap-2"><button type="submit" class="btn btn-primary"><i class="bi bi-check-lg"></i> Add Savings</button><a href="/projects/${p.ProjectID}" class="btn btn-outline-secondary">Cancel</a></div>
</form>
<script>
function toggleType(){document.getElementById('svLabel').textContent=document.getElementById('savingsAmountType').value==='Percentage'?'Savings Percentage (%)':'Savings Amount ($)';calcSavings();}
function calcSavings(){var sp=parseFloat(document.getElementById('spend').value)||0,t=document.getElementById('savingsAmountType').value,v=parseFloat(document.getElementById('svValue').value)||0,s=t==='Percentage'?sp*(v/100):v;document.getElementById('savings').value=s.toFixed(2);calcNetCoi();}
function calcNetCoi(){var s=parseFloat(document.getElementById('savings').value)||0;var ots=document.getElementById('oneTimeSavings').value;var implDate=document.getElementById('implDate').value;if(ots==='Yes'){document.getElementById('net').value=s.toFixed(2);document.getElementById('coi').value='0.00';return;}if(implDate){var m=parseInt(implDate.split('-')[1],10);var fme=((m-10)+12)%12;var net=((12-fme)/12)*s;document.getElementById('net').value=net.toFixed(2);document.getElementById('coi').value=(s-net).toFixed(2);}else{document.getElementById('net').value='';document.getElementById('coi').value='';}}
</script>`);
};

// ==================== ADMIN: USERS ====================
exports.userList = (data) => {
  const rows = data.users.map(u => `<tr class="${u.Inactive ? 'table-secondary' : ''}">
    <td>${e(u.username)}</td><td>${e(u.DisplayName)}</td><td>${e(u.EMail || '-')}</td>
    <td>${u.RoleNames ? u.RoleNames.split(', ').map(r => roleBadge(r)).join(' ') : '<span class="text-muted">No roles</span>'}</td>
    <td><span class="badge bg-${u.Inactive ? 'secondary' : 'success'}">${u.Inactive ? 'Inactive' : 'Active'}</span></td>
    <td><div class="btn-group btn-group-sm">
      <a href="/admin/users/${u.userID}/edit" class="btn btn-outline-primary"><i class="bi bi-pencil"></i></a>
      <form method="POST" action="/admin/users/${u.userID}/toggle" class="d-inline"><button class="btn btn-outline-${u.Inactive ? 'success' : 'warning'}" title="${u.Inactive ? 'Activate' : 'Deactivate'}"><i class="bi bi-${u.Inactive ? 'check-circle' : 'pause-circle'}"></i></button></form>
    </div></td></tr>`).join('');
  return page(data, `
<div class="d-flex justify-content-between align-items-center mb-3">
  <h3><i class="bi bi-people"></i> User Management</h3>
  <a href="/admin/users/create" class="btn btn-primary"><i class="bi bi-plus-lg"></i> New User</a>
</div>
<div class="table-responsive"><table class="table table-hover table-sm">
  <thead class="table-dark"><tr><th>Username</th><th>Display Name</th><th>Email</th><th>Roles</th><th>Status</th><th>Actions</th></tr></thead>
  <tbody>${rows}</tbody></table></div>`);
};

// ==================== ADMIN: USER FORM ====================
exports.userForm = (data) => {
  const { formUser: u, allRoles = [], businessUnits = [], allRegions = [], userRoles = [], userBUs = [], userRegions = [] } = data;
  const isEdit = u && u.userID;
  return page(data, `
<div class="d-flex justify-content-between align-items-center mb-3">
  <h3>${isEdit ? 'Edit User' : 'Create User'}</h3>
  <a href="/admin/users" class="btn btn-outline-secondary"><i class="bi bi-arrow-left"></i> Back</a>
</div>
${data.error ? `<div class="alert alert-danger">${e(data.error)}</div>` : ''}
<form method="POST" action="${isEdit ? '/admin/users/' + u.userID + '/edit' : '/admin/users/create'}">
  <div class="row"><div class="col-md-6">
    <div class="card mb-3"><div class="card-header"><strong>User Details</strong></div><div class="card-body">
      <div class="mb-3"><label class="form-label">Username *</label><input type="text" class="form-control" name="username" value="${e(isEdit ? u.username : '')}" ${isEdit ? 'readonly' : 'required'}></div>
      <div class="mb-3"><label class="form-label">Display Name *</label><input type="text" class="form-control" name="displayName" value="${e(isEdit ? u.DisplayName || '' : '')}" required></div>
      <div class="mb-3"><label class="form-label">Email</label><input type="email" class="form-control" name="email" value="${e(isEdit ? u.EMail || '' : '')}"></div>
      <div class="mb-3"><label class="form-label">Password ${isEdit ? '(blank=keep)' : ''}</label><input type="password" class="form-control" name="password" ${!isEdit ? 'required' : ''}></div>
      ${isEdit ? `<div class="form-check"><input type="checkbox" class="form-check-input" name="inactive" id="inactive" ${u.Inactive ? 'checked' : ''}><label class="form-check-label" for="inactive">Inactive</label></div>` : ''}
    </div></div>
  </div><div class="col-md-6">
    <div class="card mb-3"><div class="card-header"><strong>Roles</strong></div><div class="card-body">
      ${allRoles.map(r => `<div class="form-check"><input type="checkbox" class="form-check-input" name="roles" value="${r.RoleID}" id="r${r.RoleID}" ${checkedInArray(userRoles, r.RoleID)}><label class="form-check-label" for="r${r.RoleID}">${roleBadge(r.RoleDescription)}</label></div>`).join('')}
    </div></div>
    <div class="card mb-3"><div class="card-header"><strong>Business Units</strong></div><div class="card-body" style="max-height:200px;overflow-y:auto">
      ${businessUnits.map(bu => `<div class="form-check"><input type="checkbox" class="form-check-input" name="businessUnits" value="${bu.Business_UnitID}" id="bu${bu.Business_UnitID}" ${checkedInArray(userBUs, bu.Business_UnitID)}><label class="form-check-label" for="bu${bu.Business_UnitID}">${e(bu.Business_UnitName)}</label></div>`).join('')}
    </div></div>
    <div class="card mb-3"><div class="card-header"><strong>Regions</strong></div><div class="card-body">
      ${allRegions.map(r => `<div class="form-check"><input type="checkbox" class="form-check-input" name="regions" value="${r.RegionID}" id="rg${r.RegionID}" ${checkedInArray(userRegions, r.RegionID)}><label class="form-check-label" for="rg${r.RegionID}">${e(r.RegionName)}</label></div>`).join('')}
    </div></div>
  </div></div>
  <div class="d-flex gap-2"><button type="submit" class="btn btn-primary"><i class="bi bi-check-lg"></i> ${isEdit ? 'Save Changes' : 'Create User'}</button><a href="/admin/users" class="btn btn-outline-secondary">Cancel</a></div>
</form>`);
};

// ==================== ADMIN: ROLES ====================
exports.roleList = (data) => {
  const rows = data.roles.map(r => `<tr>
    <td>${roleBadge(r.RoleDescription)}</td><td>${r.IsSysAdmin ? 'Yes' : 'No'}</td>
    <td>${r.PermissionNames ? r.PermissionNames.split(', ').map(p => `<span class="badge bg-light text-dark border">${e(p)}</span>`).join(' ') : '<span class="text-muted">None</span>'}</td>
    <td><a href="/admin/roles/${r.RoleID}/edit" class="btn btn-sm btn-outline-primary"><i class="bi bi-pencil"></i> Edit</a></td>
  </tr>`).join('');
  return page(data, `
<div class="d-flex justify-content-between align-items-center mb-3"><h3><i class="bi bi-shield-lock"></i> Role Management</h3></div>
<div class="table-responsive"><table class="table table-hover table-sm">
  <thead class="table-dark"><tr><th>Role</th><th>System Admin</th><th>Permissions</th><th>Actions</th></tr></thead>
  <tbody>${rows}</tbody></table></div>`);
};

// ==================== ADMIN: ROLE FORM ====================
exports.roleForm = (data) => {
  const { role, allPermissions = [], rolePerms = [] } = data;
  return page(data, `
<div class="d-flex justify-content-between align-items-center mb-3">
  <h3>Edit Role: ${e(role.RoleDescription)}</h3>
  <a href="/admin/roles" class="btn btn-outline-secondary"><i class="bi bi-arrow-left"></i> Back</a>
</div>
<form method="POST" action="/admin/roles/${role.RoleID}/edit">
  <div class="card mb-3"><div class="card-header"><strong>Role Details</strong></div><div class="card-body">
    <div class="mb-3"><label class="form-label">Role Name</label><input type="text" class="form-control" name="roleDescription" value="${e(role.RoleDescription)}" required></div>
    <div class="mb-3"><label class="form-label"><strong>Permissions</strong></label><div class="row">
      ${allPermissions.map(p => `<div class="col-md-4"><div class="form-check"><input type="checkbox" class="form-check-input" name="permissions" value="${p.PermissionID}" id="p${p.PermissionID}" ${checkedInArray(rolePerms, p.PermissionID)}><label class="form-check-label" for="p${p.PermissionID}">${e(p.PermissionDescription)}</label></div></div>`).join('')}
    </div></div>
  </div></div>
  <div class="d-flex gap-2"><button type="submit" class="btn btn-primary"><i class="bi bi-check-lg"></i> Save</button><a href="/admin/roles" class="btn btn-outline-secondary">Cancel</a></div>
</form>`);
};

// ==================== SSLC BROWSER ====================
exports.sslcBrowser = (data) => {
  const { project: p, sslcs, linkedSSLCs = [], purchaseTypes = [], filters = {} } = data;
  const rows = sslcs.map(s => {
    const isLinked = linkedSSLCs.includes(s.ID);
    return `<tr class="${isLinked ? 'table-info' : ''}">
      <td><input type="checkbox" name="sslcIds" value="${s.ID}" ${isLinked ? 'disabled checked' : ''} class="sslc-check"></td>
      <td>${e(s.SSLC_ID)}</td><td>${s.RollupYear}Q${s.RollupQuarter}</td>
      <td>${e(s.SiteName || '-')}</td><td>${e(s.SupplierName || '-')}</td>
      <td>${e(s.LocalSupplierName || '-')}</td><td>${e(s.Commodity_DescriptionName || '-')}</td>
      <td>${e(s.CommodityCode || '-')}</td><td>${e(s.PurchaseTypeName || '-')}</td>
      <td>${e(s.Business_UnitName || '-')}</td><td>${e(s.RegionName || '-')}</td>
      <td class="text-end">${formatMoney(s.BaseSpendVolume)}</td>
      <td class="text-end">${formatMoney(s.AdjustmentVolume)}</td>
      <td class="text-end fw-bold">${formatMoney(s.TotalSpend)}</td>
      <td>${isLinked ? '<span class="badge bg-success">Linked</span>' : ''}</td>
    </tr>`;
  }).join('');

  return page(data, `
<div class="d-flex justify-content-between align-items-center mb-3">
  <div><h3><i class="bi bi-link-45deg"></i> Link SSLCs to Project</h3><span class="text-muted">${e(p.ProjectName)}</span> <span class="badge bg-info">${e(p.Commodity_TypeName)}</span></div>
  <div><a href="/projects/${p.ProjectID}" class="btn btn-outline-secondary"><i class="bi bi-arrow-left"></i> Back</a> <a href="/spend/${p.ProjectID}/details" class="btn btn-outline-success"><i class="bi bi-currency-dollar"></i> Spend &amp; Savings</a></div>
</div>
<div class="card mb-3"><div class="card-body py-2">
  <form method="GET" action="/spend/${p.ProjectID}/sslc" class="row g-2 align-items-end">
    <div class="col-md-2"><input type="text" class="form-control form-control-sm" name="supplier" placeholder="Supplier..." value="${e(filters.supplier || '')}"></div>
    <div class="col-md-2"><input type="text" class="form-control form-control-sm" name="site" placeholder="Site..." value="${e(filters.site || '')}"></div>
    <div class="col-md-2"><input type="text" class="form-control form-control-sm" name="commodityDesc" placeholder="Commodity..." value="${e(filters.commodityDesc || '')}"></div>
    <div class="col-md-2"><select class="form-select form-select-sm" name="purchaseType"><option value="">All Purchase Types</option>${purchaseTypes.map(pt => `<option value="${pt.PurchaseTypeID}" ${selected(filters.purchaseType, pt.PurchaseTypeID)}>${e(pt.PurchaseTypeName)}</option>`).join('')}</select></div>
    <div class="col-md-2"><div class="form-check"><input type="checkbox" class="form-check-input" name="excludeZero" value="1" id="exZ" ${filters.excludeZero === '1' ? 'checked' : ''}><label class="form-check-label" for="exZ">Exclude $0</label></div></div>
    <div class="col-md-2"><button type="submit" class="btn btn-sm btn-outline-primary">Filter</button> <a href="/spend/${p.ProjectID}/sslc" class="btn btn-sm btn-outline-secondary">Clear</a></div>
  </form>
</div></div>
<form method="POST" action="/spend/${p.ProjectID}/sslc/link">
  <div class="card"><div class="card-header d-flex justify-content-between align-items-center">
    <strong>Available SSLCs (${sslcs.length})</strong>
    <button type="submit" class="btn btn-primary btn-sm"><i class="bi bi-link-45deg"></i> Link Selected</button>
  </div>
  <div class="card-body p-0"><div class="table-responsive" style="max-height:600px;overflow-y:auto">
    <table class="table table-hover table-sm mb-0">
      <thead class="table-light sticky-top"><tr>
        <th><input type="checkbox" id="selAll" onchange="document.querySelectorAll('.sslc-check:not(:disabled)').forEach(c=>c.checked=this.checked)"></th>
        <th>SSLC ID</th><th>Rollup</th><th>Site</th><th>Supplier</th><th>Local Supplier</th><th>Commodity</th><th>Code</th><th>Purchase Type</th><th>BU</th><th>Region</th><th class="text-end">Base Spend</th><th class="text-end">Adjust</th><th class="text-end">Total</th><th>Status</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="15" class="text-center text-muted py-4">No SSLCs found.</td></tr>'}</tbody>
    </table>
  </div></div></div>
</form>`);
};

// ==================== SPEND DETAILS ====================
exports.spendDetails = (data) => {
  const { project: p, details, savings, totalSpend, totalSavings, isDirect } = data;
  const isDirectProject = isDirect || p.SCSCommodity_TypeID === 2;

  // Detail rows - different columns for Direct vs Indirect/Logistics
  const detailRows = details.map(d => `<tr>
    <td>${e(d.Commodity_DescriptionName || '-')}</td><td>${e(d.CommodityCode || '-')}</td>
    <td>${e(d.SupplierName || '-')}</td><td>${e(d.SiteName || '-')}</td>
    <td>${e(d.Business_UnitName || '-')}</td><td>${e(d.RegionName || '-')}</td>
    <td>${e(d.PurchaseTypeName || '-')}</td>
    ${isDirectProject ? `
    <td class="text-end">${formatMoney(d.BaseSpendVolume)}</td>
    <td class="text-end">${formatMoney(d.AdjustmentVolume)}</td>
    <td class="text-end fw-bold">${formatMoney(d.SSLCTotalSpend)}</td>` : ''}
    ${isDirectProject && hasPerm(data, 'LinkSSLC') && d.SSLCs_ID ? `<td><form method="POST" action="/spend/${p.ProjectID}/sslc/${d.SSLCs_ID}/unlink" onsubmit="return confirm('Unlink?')"><button class="btn btn-sm btn-outline-danger"><i class="bi bi-x-circle"></i></button></form></td>` : ''}
    ${!isDirectProject && hasPerm(data, 'EditProject') ? `<td><form method="POST" action="/projects/${p.ProjectID}/details/${d.ProjectDetailsID}/delete" onsubmit="return confirm('Remove this line?')"><button class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button></form></td>` : ''}
  </tr>`).join('');

  const savingsRows = savings.map(s => `<tr>
    <td>${s.SavingsID}</td><td>${e(s.SavingsAmountType)} ${s.SavingsAmountType === 'Percentage' && s.SavingsAmountValue ? '(' + s.SavingsAmountValue + '%)' : ''}</td>
    <td class="text-end">${formatMoney(s.Spend)}</td><td class="text-end text-success">${formatMoney(s.Savings)}</td>
    <td class="text-end">${formatMoney(s.COI)}</td><td class="text-end fw-bold">${formatMoney(s.NET)}</td>
    <td>${statusBadge(s.Status)}</td><td>${e(s.ImplementationDate || '-')}</td>
    <td>${e(s.OneTimeSavings || '-')}</td><td>${e(s.Remarks || '-')}</td><td>${e(s.UpdatedBy || '-')}</td>
  </tr>`).join('');

  const rate = totalSpend > 0 ? ((totalSavings / totalSpend) * 100).toFixed(1) : '0.0';
  const spendLabel = isDirectProject ? 'Total Spend (SSLCs)' : 'Total Spend';

  // Add detail line form for Indirect/Logistics projects
  const addDetailForm = !isDirectProject && hasPerm(data, 'EditProject') ? `
<div class="card mb-3"><div class="card-header"><strong><i class="bi bi-plus-circle"></i> Add Detail Line</strong></div><div class="card-body">
  <form method="POST" action="/projects/${p.ProjectID}/details/add" class="row g-2 align-items-end">
    <div class="col-md-2"><label class="form-label">Commodity Team</label><select class="form-select form-select-sm" name="commodityTeamID">
      <option value="">Select...</option>${(data.commodityTeams||[]).map(ct => `<option value="${ct.Commodity_Team_NameID}">${e(ct.Commodity_Team_NameDesc)}</option>`).join('')}
    </select></div>
    <div class="col-md-2"><label class="form-label">Commodity Family</label><select class="form-select form-select-sm" name="commodityFamilyID">
      <option value="">Select...</option>${(data.commodityFamilies||[]).map(cf => `<option value="${cf.Commodity_FamilyID}">${e(cf.Commodity_FamilyName)}</option>`).join('')}
    </select></div>
    <div class="col-md-2"><label class="form-label">Commodity Desc</label><select class="form-select form-select-sm" name="commodityDescID">
      <option value="">Select...</option>${(data.commodityDescriptions||[]).map(cd => `<option value="${cd.Commodity_DescriptionID}">${e(cd.Commodity_DescriptionName)}</option>`).join('')}
    </select></div>
    <div class="col-md-2"><label class="form-label">Supplier</label><select class="form-select form-select-sm" name="supplierID">
      <option value="">Select...</option>${(data.suppliers||[]).map(s => `<option value="${s.SupplierID}">${e(s.SupplierName)}</option>`).join('')}
    </select></div>
    <div class="col-md-2"><label class="form-label">Local Supplier</label><select class="form-select form-select-sm" name="localSupplierID">
      <option value="">Select...</option>${(data.localSuppliers||[]).map(ls => `<option value="${ls.LocalSupplierID}">${e(ls.LocalSupplierName)}</option>`).join('')}
    </select></div>
    <div class="col-md-2"><label class="form-label">Business Unit</label><select class="form-select form-select-sm" name="businessUnitID">
      <option value="">Select...</option>${(data.businessUnits||[]).map(bu => `<option value="${bu.Business_UnitID}">${e(bu.Business_UnitName)}</option>`).join('')}
    </select></div>
    <div class="col-md-2"><label class="form-label">Region</label><select class="form-select form-select-sm" name="regionID">
      <option value="">Select...</option>${(data.regions||[]).map(r => `<option value="${r.RegionID}">${e(r.RegionName)}</option>`).join('')}
    </select></div>
    <div class="col-md-2"><label class="form-label">Site</label><select class="form-select form-select-sm" name="siteID">
      <option value="">Select...</option>${(data.sites||[]).map(s => `<option value="${s.SiteID}">${e(s.SiteName)}</option>`).join('')}
    </select></div>
    <div class="col-md-2"><label class="form-label">Purchase Type</label><select class="form-select form-select-sm" name="purchaseTypeID">
      <option value="">Select...</option>${(data.purchaseTypes||[]).map(pt => `<option value="${pt.PurchaseTypeID}">${e(pt.PurchaseTypeName)}</option>`).join('')}
    </select></div>
    <div class="col-md-2"><button type="submit" class="btn btn-primary btn-sm w-100"><i class="bi bi-plus-lg"></i> Add Line</button></div>
  </form>
</div></div>` : '';

  // Update spend form for Indirect/Logistics
  const updateSpendForm = !isDirectProject && hasPerm(data, 'AddSpend') ? `
<div class="card mb-3"><div class="card-header"><strong>Project Spend</strong></div><div class="card-body">
  <form method="POST" action="/spend/${p.ProjectID}/update-spend" class="row g-2 align-items-end">
    <div class="col-md-4"><label class="form-label">Total Spend ($)</label><input type="number" step="0.01" class="form-control" name="spend" value="${totalSpend}" required></div>
    <div class="col-md-4"><button type="submit" class="btn btn-primary"><i class="bi bi-check-lg"></i> Update Spend</button></div>
    <div class="col-md-4"><small class="text-muted">This will update spend across all savings records and recalculate savings.</small></div>
  </form>
</div></div>` : '';

  return page(data, `
<div class="d-flex justify-content-between align-items-center mb-3">
  <div><h3><i class="bi bi-currency-dollar"></i> Spend &amp; Savings Details</h3><span class="text-muted">${e(p.ProjectName)}</span> <span class="badge bg-${isDirectProject ? 'info' : 'secondary'}">${e(p.Commodity_TypeName)}</span></div>
  <div><a href="/projects/${p.ProjectID}" class="btn btn-outline-secondary"><i class="bi bi-arrow-left"></i> Back</a>
    ${isDirectProject && hasPerm(data, 'LinkSSLC') ? `<a href="/spend/${p.ProjectID}/sslc" class="btn btn-outline-info"><i class="bi bi-link-45deg"></i> Link SSLCs</a>` : ''}
    ${hasPerm(data, 'AddSavings') ? `<a href="/projects/${p.ProjectID}/savings/add" class="btn btn-outline-warning"><i class="bi bi-plus-circle"></i> Add Savings</a>` : ''}
  </div>
</div>
<div class="row mb-3">
  <div class="col-md-3"><div class="card text-center"><div class="card-body"><h6 class="text-muted">${spendLabel}</h6><h3 class="text-primary">${formatMoney(totalSpend)}</h3></div></div></div>
  <div class="col-md-3"><div class="card text-center"><div class="card-body"><h6 class="text-muted">Total Savings</h6><h3 class="text-success">${formatMoney(totalSavings)}</h3></div></div></div>
  <div class="col-md-3"><div class="card text-center"><div class="card-body"><h6 class="text-muted">Savings Rate</h6><h3>${rate}%</h3></div></div></div>
  <div class="col-md-3"><div class="card text-center"><div class="card-body"><h6 class="text-muted">Detail Lines</h6><h3>${details.length}</h3></div></div></div>
</div>
${updateSpendForm}
${addDetailForm}
<div class="card mb-3"><div class="card-header"><strong>Project Detail Lines</strong></div><div class="card-body p-0">
  ${details.length === 0 ? `<p class="text-muted text-center py-3 mb-0">No detail lines. ${isDirectProject ? `<a href="/spend/${p.ProjectID}/sslc">Link SSLCs</a> to add spend.` : 'Use the form above to add detail lines.'}</p>` :
    `<div class="table-responsive"><table class="table table-sm table-hover mb-0">
      <thead class="table-light"><tr><th>Commodity</th><th>Code</th><th>Supplier</th><th>Site</th><th>BU</th><th>Region</th><th>Purchase Type</th>${isDirectProject ? '<th class="text-end">Base</th><th class="text-end">Adjust</th><th class="text-end">Total</th>' : ''}<th></th></tr></thead>
      <tbody>${detailRows}</tbody>
      ${isDirectProject ? `<tfoot class="table-dark"><tr><td colspan="7" class="text-end fw-bold">Total:</td><td class="text-end">${formatMoney(details.reduce((s,d) => s + (d.BaseSpendVolume||0), 0))}</td><td class="text-end">${formatMoney(details.reduce((s,d) => s + (d.AdjustmentVolume||0), 0))}</td><td class="text-end fw-bold">${formatMoney(totalSpend)}</td><td></td></tr></tfoot>` : ''}
    </table></div>`}
</div></div>
<div class="card"><div class="card-header"><strong>Savings Records</strong></div><div class="card-body p-0">
  ${savings.length === 0 ? `<p class="text-muted text-center py-3 mb-0">No savings records. <a href="/projects/${p.ProjectID}/savings/add">Add savings</a>.</p>` :
    `<div class="table-responsive"><table class="table table-sm table-hover mb-0">
      <thead class="table-light"><tr><th>ID</th><th>Type</th><th class="text-end">Spend</th><th class="text-end">Savings</th><th class="text-end">COI</th><th class="text-end">NET</th><th>Status</th><th>Impl Date</th><th>One-Time</th><th>Remarks</th><th>Updated By</th></tr></thead>
      <tbody>${savingsRows}</tbody></table></div>`}
</div></div>`);
};
