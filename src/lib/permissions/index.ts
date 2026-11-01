import type { Role } from '@/types/domain';
export type Permission =
  | 'manage_catalog'
  | 'view_operations'
  | 'view_financials'
  | 'submit_work'
  | 'view_audit'
  | 'manage_users';
export function can(roles: readonly Role[], permission: Permission): boolean {
  if (permission === 'submit_work') return roles.includes('WORKER');
  if (permission === 'view_audit' || permission === 'manage_users') return roles.includes('ADMIN');
  return roles.includes('ADMIN') || roles.includes('OWNER');
}
export function canReadWork(roles: readonly Role[], viewerId: string, workerId: string) {
  return can(roles, 'view_operations') || (roles.includes('WORKER') && viewerId === workerId);
}
