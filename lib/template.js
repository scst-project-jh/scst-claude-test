// Simple HTML template helpers - no external template engine needed.
// All rendering is done via template literal strings in the view functions.

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function e(val) { return escapeHtml(val); }

function formatMoney(val) {
  const n = Number(val) || 0;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function layout(title, user, flash, isAdmin, permissions, bodyHtml) {
  const flashHtml = (flash && flash.success ? `<div class="alert alert-success alert-dismissible fade show" role="alert">${e(flash.success)}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>` : '') +
    (flash && flash.error ? `<div class="alert alert-danger alert-dismissible fade show" role="alert">${e(flash.error)}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>` : '');

  const navHtml = user ? `
<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
  <div class="container-fluid">
    <a class="navbar-brand" href="/projects"><i class="bi bi-bar-chart-line"></i> SCST</a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"><span class="navbar-toggler-icon"></span></button>
    <div class="collapse navbar-collapse" id="navbarNav">
      <ul class="navbar-nav me-auto">
        <li class="nav-item"><a class="nav-link" href="/projects"><i class="bi bi-folder2-open"></i> Projects</a></li>
        <li class="nav-item"><a class="nav-link" href="/projects/archive/list"><i class="bi bi-archive"></i> Archived</a></li>
        ${isAdmin ? `<li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown"><i class="bi bi-gear"></i> Admin</a>
          <ul class="dropdown-menu">
            <li><a class="dropdown-item" href="/admin/users"><i class="bi bi-people"></i> Users</a></li>
            <li><a class="dropdown-item" href="/admin/roles"><i class="bi bi-shield-lock"></i> Roles</a></li>
          </ul>
        </li>` : ''}
      </ul>
      <ul class="navbar-nav">
        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown"><i class="bi bi-person-circle"></i> ${e(user.DisplayName)}</a>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><span class="dropdown-item-text text-muted small">${e((user.roles || []).join(', '))}</span></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item" href="/auth/logout"><i class="bi bi-box-arrow-right"></i> Logout</a></li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
</nav>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(title)} - SCST</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
  <link href="/css/styles.css" rel="stylesheet">
</head>
<body>
${navHtml}
<div class="container-fluid mt-3">
${flashHtml}
${bodyHtml}
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
}

function statusBadge(status) {
  const colors = { Active: 'success', Draft: 'warning', Approved: 'primary', 'Pending Approval': 'info', Rejected: 'danger', Archived: 'dark', Deleted: 'secondary', Pending: 'warning' };
  return `<span class="badge bg-${colors[status] || 'secondary'}">${e(status)}</span>`;
}

function roleBadge(role) {
  const colors = { Admin: 'danger', Approver: 'warning', User: 'info' };
  return `<span class="badge bg-${colors[role] || 'secondary'}">${e(role)}</span>`;
}

function selected(val1, val2) { return String(val1) === String(val2) ? 'selected' : ''; }
function checked(val1, val2) { return String(val1) === String(val2) ? 'checked' : ''; }
function checkedInArray(arr, val) { return Array.isArray(arr) && arr.includes(val) ? 'checked' : ''; }

module.exports = { escapeHtml, e, formatMoney, layout, statusBadge, roleBadge, selected, checked, checkedInArray };
