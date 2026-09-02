export const ALL_PERMISSIONS = '*';

export const PERMISSION_CATALOG = [
  { key: 'dashboard.read', group: 'Dashboard', label: 'View dashboard', description: 'View platform statistics and the admin overview.' },
  { key: 'users.read', group: 'Users', label: 'View users', description: 'View user lists and account details.' },
  { key: 'users.create', group: 'Users', label: 'Create users', description: 'Create buyer, seller, and administrator accounts.' },
  { key: 'users.assign_role', group: 'Users', label: 'Assign roles', description: 'Assign compatible access roles to user accounts.' },
  { key: 'users.suspend', group: 'Users', label: 'Suspend users', description: 'Suspend and reactivate user accounts.' },
  { key: 'roles.read', group: 'Access control', label: 'View roles', description: 'View roles and the permission catalog.' },
  { key: 'roles.manage', group: 'Access control', label: 'Manage roles', description: 'Create, edit, and remove custom roles.' },
  { key: 'seller_applications.read', group: 'Sellers', label: 'View applications', description: 'View seller applications and evidence.' },
  { key: 'seller_applications.review', group: 'Sellers', label: 'Review applications', description: 'Approve, reject, or request seller information.' },
  { key: 'catalog.read', group: 'Catalog', label: 'View catalog', description: 'View all products and stores for moderation.' },
  { key: 'catalog.manage', group: 'Catalog', label: 'Moderate catalog', description: 'Activate, deactivate, and recategorize products or stores.' },
  { key: 'admin_stores.read', group: 'Admin storefronts', label: 'View priority stores', description: 'View admin-managed storefronts and their products.' },
  { key: 'admin_stores.manage', group: 'Admin storefronts', label: 'Manage priority stores', description: 'Create and manage admin-owned storefronts, their products, and pre-order settings.' },
  { key: 'categories.read', group: 'Catalog', label: 'View categories', description: 'View inactive and active marketplace categories.' },
  { key: 'categories.manage', group: 'Catalog', label: 'Manage categories', description: 'Create, edit, and remove marketplace categories.' },
  { key: 'content.read', group: 'Content', label: 'View homepage content', description: 'View all homepage hero content.' },
  { key: 'content.manage', group: 'Content', label: 'Manage homepage content', description: 'Create, edit, and remove homepage hero content.' },
  { key: 'delivery_locations.read', group: 'Fulfillment', label: 'View delivery locations', description: 'View all delivery and pickup locations.' },
  { key: 'delivery_locations.manage', group: 'Fulfillment', label: 'Manage delivery locations', description: 'Create, edit, and remove delivery locations.' },
  { key: 'finance.read', group: 'Finance', label: 'View finance', description: 'View donations and platform payment methods.' },
  { key: 'finance.manage', group: 'Finance', label: 'Manage finance', description: 'Manage payment methods and verify donation payments.' },
  { key: 'complaints.read', group: 'Trust and safety', label: 'View complaints', description: 'View marketplace complaints and evidence.' },
  { key: 'complaints.manage', group: 'Trust and safety', label: 'Resolve complaints', description: 'Change complaint status and record resolutions.' },
  { key: 'orders.read', group: 'Orders', label: 'View all orders', description: 'View all orders and pre-orders across the platform.' },
  { key: 'orders.manage', group: 'Orders', label: 'Manage all orders', description: 'Perform administrator actions on orders and pre-orders.' },
  { key: 'settings.read', group: 'Settings', label: 'View settings', description: 'View platform configuration.' },
  { key: 'settings.manage', group: 'Settings', label: 'Manage settings', description: 'Change platform branding and configuration.' },
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]['key'];
export const PERMISSION_KEYS = new Set<string>(PERMISSION_CATALOG.map((permission) => permission.key));
