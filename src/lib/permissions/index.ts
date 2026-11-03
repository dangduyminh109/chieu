import type { Role } from '@/types/domain';
export type Permission =
  | 'manage_catalog'
  | 'view_operations'
  | 'view_financials'
  | 'submit_work'
  | 'view_audit'
  | 'delete_records'
  | 'manage_users'
  | 'provision_users';
// Account provisioning is separate from administrator-only role management.
export function can(roles: readonly Role[], permission: Permission): boolean {
  if (permission === 'submit_work') return roles.includes('WORKER');
  if (permission === 'view_audit' || permission === 'manage_users' || permission === 'delete_records') return roles.includes('ADMIN');
  return roles.includes('ADMIN') || roles.includes('OWNER');
}
export function canReadWork(roles: readonly Role[], viewerId: string, workerId: string) {
  return can(roles, 'view_operations') || (roles.includes('WORKER') && viewerId === workerId);
}
