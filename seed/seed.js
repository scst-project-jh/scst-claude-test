const { getDb, saveDb, nextId } = require('../config/database');
const crypto = require('crypto');

function seed() {
  const db = getDb();

  if (db.Roles.length > 0) {
    console.log('Database already seeded.');
    return;
  }

  console.log('Seeding database...');

  // Roles
  db.Roles.push({ RoleID: nextId('Roles'), RoleDescription: 'Admin', IsSysAdmin: 1 });
  db.Roles.push({ RoleID: nextId('Roles'), RoleDescription: 'Approver', IsSysAdmin: 0 });
  db.Roles.push({ RoleID: nextId('Roles'), RoleDescription: 'User', IsSysAdmin: 0 });

  // Permissions
  const perms = [
    'ViewProject', 'EditProject', 'CreateProject', 'DeleteProject',
    'ArchiveProject', 'ManageUsers', 'ManageRoles', 'ApproveSavings',
    'AddSpend', 'AddSavings', 'LinkSSLC', 'ViewReports'
  ];
  perms.forEach(p => db.Permissions.push({ PermissionID: nextId('Permissions'), PermissionDescription: p }));

  // Role-Permission links
  for (let i = 1; i <= 12; i++) db.lnkRolePermission.push({ RoleID: 1, PermissionID: i });
  [1,2,3,4,5,8,9,10,11,12].forEach(p => db.lnkRolePermission.push({ RoleID: 2, PermissionID: p }));
  [1,2,3,9,10,11].forEach(p => db.lnkRolePermission.push({ RoleID: 3, PermissionID: p }));

  // Commodity Types
  db.Commodity_Type.push({ Commodity_TypeID: nextId('Commodity_Type'), Commodity_TypeName: 'Indirect' });
  db.Commodity_Type.push({ Commodity_TypeID: nextId('Commodity_Type'), Commodity_TypeName: 'Direct' });
  db.Commodity_Type.push({ Commodity_TypeID: nextId('Commodity_Type'), Commodity_TypeName: 'Logistics' });

  // Commodity Teams
  db.Commodity_Team_Name.push({ Commodity_Team_NameID: nextId('Commodity_Team_Name'), Commodity_Team_NameDesc: 'Raw Materials', Commodity_TypeID: 1 });
  db.Commodity_Team_Name.push({ Commodity_Team_NameID: nextId('Commodity_Team_Name'), Commodity_Team_NameDesc: 'Packaging', Commodity_TypeID: 1 });
  db.Commodity_Team_Name.push({ Commodity_Team_NameID: nextId('Commodity_Team_Name'), Commodity_Team_NameDesc: 'Logistics', Commodity_TypeID: 2 });
  db.Commodity_Team_Name.push({ Commodity_Team_NameID: nextId('Commodity_Team_Name'), Commodity_Team_NameDesc: 'MRO', Commodity_TypeID: 2 });

  // Commodity Families
  db.Commodity_Family.push({ Commodity_FamilyID: nextId('Commodity_Family'), Commodity_FamilyName: 'Metals', Commodity_Team_NameID: 1 });
  db.Commodity_Family.push({ Commodity_FamilyID: nextId('Commodity_Family'), Commodity_FamilyName: 'Plastics', Commodity_Team_NameID: 1 });
  db.Commodity_Family.push({ Commodity_FamilyID: nextId('Commodity_Family'), Commodity_FamilyName: 'Corrugated', Commodity_Team_NameID: 2 });
  db.Commodity_Family.push({ Commodity_FamilyID: nextId('Commodity_Family'), Commodity_FamilyName: 'Freight', Commodity_Team_NameID: 3 });
  db.Commodity_Family.push({ Commodity_FamilyID: nextId('Commodity_Family'), Commodity_FamilyName: 'Industrial Supplies', Commodity_Team_NameID: 4 });

  // Commodity Descriptions
  db.Commodity_Description.push({ Commodity_DescriptionID: nextId('Commodity_Description'), Commodity_DescriptionName: 'Steel Sheets', Code: 'MTL-001', Commodity_FamilyID: 1 });
  db.Commodity_Description.push({ Commodity_DescriptionID: nextId('Commodity_Description'), Commodity_DescriptionName: 'Aluminum Extrusions', Code: 'MTL-002', Commodity_FamilyID: 1 });
  db.Commodity_Description.push({ Commodity_DescriptionID: nextId('Commodity_Description'), Commodity_DescriptionName: 'HDPE Resin', Code: 'PLS-001', Commodity_FamilyID: 2 });
  db.Commodity_Description.push({ Commodity_DescriptionID: nextId('Commodity_Description'), Commodity_DescriptionName: 'Corrugated Boxes', Code: 'CRG-001', Commodity_FamilyID: 3 });
  db.Commodity_Description.push({ Commodity_DescriptionID: nextId('Commodity_Description'), Commodity_DescriptionName: 'LTL Freight', Code: 'FRT-001', Commodity_FamilyID: 4 });
  db.Commodity_Description.push({ Commodity_DescriptionID: nextId('Commodity_Description'), Commodity_DescriptionName: 'Safety Equipment', Code: 'MRO-001', Commodity_FamilyID: 5 });

  // Project Types
  ['Cost Reduction', 'Cost Avoidance', 'Revenue Enhancement', 'Process Improvement'].forEach(n =>
    db.ProjectType.push({ ProjectTypeID: nextId('ProjectType'), ProjectTypeName: n }));

  // Project Statuses
  ['Draft', 'Active', 'Pending Approval', 'Approved', 'Rejected', 'Archived', 'Deleted'].forEach(n =>
    db.Project_Status.push({ Project_StatusID: nextId('Project_Status'), Name: n }));

  // Business Groups
  db.Business_Group.push({ Business_GroupID: nextId('Business_Group'), Business_GroupName: 'Manufacturing' });
  db.Business_Group.push({ Business_GroupID: nextId('Business_Group'), Business_GroupName: 'Services' });

  // Business Segments
  db.Business_Segment.push({ Business_SegmentID: nextId('Business_Segment'), Business_SegmentName: 'Heavy Manufacturing', Business_GroupID: 1 });
  db.Business_Segment.push({ Business_SegmentID: nextId('Business_Segment'), Business_SegmentName: 'Light Manufacturing', Business_GroupID: 1 });
  db.Business_Segment.push({ Business_SegmentID: nextId('Business_Segment'), Business_SegmentName: 'Professional Services', Business_GroupID: 2 });

  // Business Units
  db.Business_Unit.push({ Business_UnitID: nextId('Business_Unit'), Business_UnitName: 'Plant Operations', Business_SegmentID: 1 });
  db.Business_Unit.push({ Business_UnitID: nextId('Business_Unit'), Business_UnitName: 'Assembly Lines', Business_SegmentID: 1 });
  db.Business_Unit.push({ Business_UnitID: nextId('Business_Unit'), Business_UnitName: 'Electronics Division', Business_SegmentID: 2 });
  db.Business_Unit.push({ Business_UnitID: nextId('Business_Unit'), Business_UnitName: 'Consulting', Business_SegmentID: 3 });

  // Regions
  ['North America', 'Europe', 'Asia Pacific', 'Latin America'].forEach(n =>
    db.Region.push({ RegionID: nextId('Region'), RegionName: n }));

  // Business Sites
  db.Business_Sites.push({ SiteID: nextId('Business_Sites'), SiteName: 'Chicago Plant', SiteCode: 'CHI-01', Business_UnitID: 1, RegionID: 1 });
  db.Business_Sites.push({ SiteID: nextId('Business_Sites'), SiteName: 'Detroit Assembly', SiteCode: 'DET-01', Business_UnitID: 2, RegionID: 1 });
  db.Business_Sites.push({ SiteID: nextId('Business_Sites'), SiteName: 'Munich Factory', SiteCode: 'MUN-01', Business_UnitID: 3, RegionID: 2 });
  db.Business_Sites.push({ SiteID: nextId('Business_Sites'), SiteName: 'Shanghai Facility', SiteCode: 'SHG-01', Business_UnitID: 1, RegionID: 3 });
  db.Business_Sites.push({ SiteID: nextId('Business_Sites'), SiteName: 'Sao Paulo Office', SiteCode: 'SAO-01', Business_UnitID: 4, RegionID: 4 });

  // Suppliers
  ['Acme Steel Corp', 'Global Plastics Inc', 'Pacific Freight LLC', 'Premium Packaging Co', 'Industrial Supply House'].forEach(n =>
    db.Suppliers.push({ SupplierID: nextId('Suppliers'), SupplierName: n }));

  // Local Suppliers
  db.LocalSuppliers.push({ LocalSupplierID: nextId('LocalSuppliers'), LocalSupplierName: 'Acme Steel - Chicago', SupplierID: 1 });
  db.LocalSuppliers.push({ LocalSupplierID: nextId('LocalSuppliers'), LocalSupplierName: 'Acme Steel - Detroit', SupplierID: 1 });
  db.LocalSuppliers.push({ LocalSupplierID: nextId('LocalSuppliers'), LocalSupplierName: 'Global Plastics - Local', SupplierID: 2 });
  db.LocalSuppliers.push({ LocalSupplierID: nextId('LocalSuppliers'), LocalSupplierName: 'Pacific Freight - West', SupplierID: 3 });
  db.LocalSuppliers.push({ LocalSupplierID: nextId('LocalSuppliers'), LocalSupplierName: 'Premium Packaging - East', SupplierID: 4 });

  // Purchase Types
  db.PurchaseTypes.push({ PurchaseTypeID: nextId('PurchaseTypes'), PurchaseTypeName: 'Direct Material', PurchaseTypeCode: 'DM' });
  db.PurchaseTypes.push({ PurchaseTypeID: nextId('PurchaseTypes'), PurchaseTypeName: 'Indirect Material', PurchaseTypeCode: 'IM' });
  db.PurchaseTypes.push({ PurchaseTypeID: nextId('PurchaseTypes'), PurchaseTypeName: 'Services', PurchaseTypeCode: 'SVC' });
  db.PurchaseTypes.push({ PurchaseTypeID: nextId('PurchaseTypes'), PurchaseTypeName: 'Capital', PurchaseTypeCode: 'CAP' });

  // Fiscal Years
  [2024, 2025, 2026].forEach(y => db.FiscalYear.push({ FY_Id: nextId('FiscalYear'), Fiscal_Year: y }));

  // SSLC Rollups
  db.SSLC_Rollups.push({ ID: nextId('SSLC_Rollups'), RollupYear: 2025, RollupQuarter: 1, IsActive: 1 });
  db.SSLC_Rollups.push({ ID: nextId('SSLC_Rollups'), RollupYear: 2025, RollupQuarter: 2, IsActive: 1 });
  db.SSLC_Rollups.push({ ID: nextId('SSLC_Rollups'), RollupYear: 2026, RollupQuarter: 1, IsActive: 1 });

  // SSLCs
  const sslcData = [
    [3, 1001, 1, 1, 1, 1, 1, 0, 500000, 0],
    [3, 1002, 1, 1, 1, 2, 1, 0, 350000, 0],
    [3, 1003, 2, 2, 3, 3, 1, 0, 200000, 0],
    [3, 1004, 3, 3, 4, 5, 3, 0, 750000, 0],
    [3, 1005, 1, 4, 5, 4, 2, 0, 180000, 0],
    [3, 1006, 4, 1, 1, 1, 1, 1, 420000, 0],
    [3, 1007, 2, 5, 5, 6, 2, 0, 95000, 0],
    [3, 1008, 5, 3, 4, 5, 3, 0, 310000, 0]
  ];
  sslcData.forEach(([rollup, sslcId, site, sup, lsup, comDesc, pt, local, base, adj]) => {
    db.SSLCs.push({
      ID: nextId('SSLCs'), SSLC_Rollup_ID: rollup, SSLC_ID: sslcId,
      SiteID: site, SupplierID: sup, LocalSupplierID: lsup,
      Commodity_DescriptionID: comDesc, PurchaseTypeID: pt,
      LocalFl: local, BaseSpendVolume: base, AdjustmentVolume: adj, IsExcluded: 0
    });
  });

  // Users
  const hash = (pw) => crypto.createHash('sha256').update(pw).digest('hex');
  db.LoginUser.push({ userID: nextId('LoginUser'), username: 'admin', DisplayName: 'System Administrator', PasswordHash: hash('admin123'), EMail: 'admin@example.com', Inactive: 0 });
  db.LoginUser.push({ userID: nextId('LoginUser'), username: 'approver', DisplayName: 'Project Approver', PasswordHash: hash('approver123'), EMail: 'approver@example.com', Inactive: 0 });
  db.LoginUser.push({ userID: nextId('LoginUser'), username: 'user', DisplayName: 'Regular User', PasswordHash: hash('user123'), EMail: 'user@example.com', Inactive: 0 });

  // Assign roles
  db.LnkUserRole.push({ userID: 1, RoleID: 1 });
  db.LnkUserRole.push({ userID: 2, RoleID: 2 });
  db.LnkUserRole.push({ userID: 3, RoleID: 3 });

  // Assign BUs/Regions
  for (let u = 1; u <= 3; u++) {
    for (let bu = 1; bu <= 4; bu++) db.LnkUserBusinessUnit.push({ userID: u, Business_UnitID: bu });
    for (let r = 1; r <= 4; r++) db.LnkUserRegion.push({ userID: u, RegionID: r });
  }

  // Sample projects
  db.ProjectHeader.push({ ID: nextId('ProjectHeader'), ProjectTypeID: 1, SCSCommodity_TypeID: 1, ProjectName: 'Steel Cost Reduction Program', ProjectOwner: 'admin', ProjectStartDate: '2025-06-01', Comments: 'Renegotiate steel supply contracts', RequestedBy: 'admin', RequestedDate: '2025-05-15', UpdatedBy: 'admin', CorporateLed: 'Yes', InsertedAt: new Date().toISOString() });
  db.ProjectHeader.push({ ID: nextId('ProjectHeader'), ProjectTypeID: 2, SCSCommodity_TypeID: 2, ProjectName: 'Freight Optimization Initiative', ProjectOwner: 'approver', ProjectStartDate: '2025-07-01', Comments: 'Optimize freight routes and consolidate shipments', RequestedBy: 'approver', RequestedDate: '2025-06-01', UpdatedBy: 'approver', CorporateLed: 'No', InsertedAt: new Date().toISOString() });
  db.ProjectHeader.push({ ID: nextId('ProjectHeader'), ProjectTypeID: 1, SCSCommodity_TypeID: 1, ProjectName: 'Packaging Consolidation', ProjectOwner: 'user', ProjectStartDate: '2025-08-01', Comments: 'Consolidate packaging suppliers', RequestedBy: 'user', RequestedDate: '2025-07-10', UpdatedBy: 'user', CorporateLed: 'Yes', InsertedAt: new Date().toISOString() });

  db.ProjectSummary.push({ ProjectID: nextId('ProjectSummary'), ProjectHeaderID: 1, ESProjectNumber: 'ES-2025-001', ProjectStatusID: 2, UpdatedBy: 'admin', RecordStatus: 'ACTIVE', FiscalYear: 2025, IsLocked: 0, InsertedAt: new Date().toISOString() });
  db.ProjectSummary.push({ ProjectID: nextId('ProjectSummary'), ProjectHeaderID: 2, ESProjectNumber: 'ES-2025-002', ProjectStatusID: 2, UpdatedBy: 'approver', RecordStatus: 'ACTIVE', FiscalYear: 2025, IsLocked: 0, InsertedAt: new Date().toISOString() });
  db.ProjectSummary.push({ ProjectID: nextId('ProjectSummary'), ProjectHeaderID: 3, ESProjectNumber: 'ES-2025-003', ProjectStatusID: 1, UpdatedBy: 'user', RecordStatus: 'ACTIVE', FiscalYear: 2025, IsLocked: 0, InsertedAt: new Date().toISOString() });

  // Project Details
  db.ProjectDetails.push({ ProjectDetailsID: nextId('ProjectDetails'), ProjectID: 1, SCSCommodity_Team_NameID: 1, SCSCommodity_FamilyID: 1, SCSCommodity_DescriptionID: 1, Commodity_Code: 'MTL-001', Supplier: 'Acme Steel Corp', SCSTBusinessUnitID: 1, RegionID: 1, SiteID: 1, Site: 'Chicago Plant', SupplierID: 1, LocalSupplierID: 1, PurchaseTypeID: 1, RecordStatus: 'ACTIVE' });
  db.ProjectDetails.push({ ProjectDetailsID: nextId('ProjectDetails'), ProjectID: 1, SCSCommodity_Team_NameID: 1, SCSCommodity_FamilyID: 1, SCSCommodity_DescriptionID: 2, Commodity_Code: 'MTL-002', Supplier: 'Acme Steel Corp', SCSTBusinessUnitID: 2, RegionID: 1, SiteID: 2, Site: 'Detroit Assembly', SupplierID: 1, LocalSupplierID: 2, PurchaseTypeID: 1, RecordStatus: 'ACTIVE' });
  db.ProjectDetails.push({ ProjectDetailsID: nextId('ProjectDetails'), ProjectID: 2, SCSCommodity_Team_NameID: 3, SCSCommodity_FamilyID: 4, SCSCommodity_DescriptionID: 5, Commodity_Code: 'FRT-001', Supplier: 'Pacific Freight LLC', SCSTBusinessUnitID: 1, RegionID: 1, SiteID: 1, Site: 'Chicago Plant', SupplierID: 3, LocalSupplierID: 4, PurchaseTypeID: 3, RecordStatus: 'ACTIVE' });
  db.ProjectDetails.push({ ProjectDetailsID: nextId('ProjectDetails'), ProjectID: 3, SCSCommodity_Team_NameID: 2, SCSCommodity_FamilyID: 3, SCSCommodity_DescriptionID: 4, Commodity_Code: 'CRG-001', Supplier: 'Premium Packaging Co', SCSTBusinessUnitID: 3, RegionID: 2, SiteID: 3, Site: 'Munich Factory', SupplierID: 4, LocalSupplierID: 5, PurchaseTypeID: 2, RecordStatus: 'ACTIVE' });

  // Savings - NET/COI calculated from implementation date
  // NET = ((12 - (((monthNumber - 10) + 12) % 12)) / 12) * Savings; COI = Savings - NET
  // For OneTimeSavings='Yes': NET = Savings, COI = 0
  // Impl date 2025-09-01: month=9, fiscalMonthsElapsed = ((9-10)+12)%12 = 11, NET = ((12-11)/12)*25000 = 2083.33
  const fme1 = ((9 - 10) + 12) % 12; // month 9 (September) => 11 fiscal months elapsed
  const net1 = Math.round(((12 - fme1) / 12) * 25000 * 100) / 100;
  db.SavingsSummary.push({ SavingsID: nextId('SavingsSummary'), Spend: 500000, SavingsAmountType: 'Percentage', SavingsAmountValue: 5, Savings: 25000, Remarks: 'Contract renegotiation savings', Status: 'Approved', NET: net1, COI: Math.round((25000 - net1) * 100) / 100, ProjectID: 1, UpdatedBy: 'admin', AdditionalSavingsConsiderations: 'Multi-year agreement', ImplementationDate: '2025-09-01', OneTimeSavings: 'No', FiscalYear: 2025 });
  // OneTimeSavings='Yes': NET = Savings, COI = 0
  db.SavingsSummary.push({ SavingsID: nextId('SavingsSummary'), Spend: 750000, SavingsAmountType: 'Fixed', SavingsAmountValue: null, Savings: 45000, Remarks: 'Route optimization savings', Status: 'Pending', NET: 45000, COI: 0, ProjectID: 2, UpdatedBy: 'approver', AdditionalSavingsConsiderations: 'Pending logistics review', ImplementationDate: '2025-10-01', OneTimeSavings: 'Yes', FiscalYear: 2026 });

  saveDb();

  console.log('Database seeded successfully!');
  console.log('Default users:');
  console.log('  admin / admin123 (Admin role)');
  console.log('  approver / approver123 (Approver role)');
  console.log('  user / user123 (User role)');
}

seed();
