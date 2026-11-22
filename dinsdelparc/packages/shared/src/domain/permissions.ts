import type { AppRole } from '../types/database';

/**
 * UI mirror of the role/permission matrix defined in
 * supabase/migrations/20261122000100_foundations.sql.
 * It is ONLY used to decide what to show; every permission is enforced again
 * by PostgreSQL (RLS, column grants and SECURITY DEFINER checks).
 */
export const ROLE_RANK: Record<AppRole, number> = {
  superadmin: 100,
  admin: 80,
  content_manager: 60,
  moderator: 50,
  editor: 40,
  verified_user: 20,
  user: 10,
};

export const PERMISSIONS = [
  'community.participate',
  'operations.report',
  'dashboard.view',
  'content.edit',
  'content.publish',
  'content.delete',
  'content.feature',
  'operations.validate',
  'operations.manage',
  'community.moderate',
  'reports.manage',
  'forum.manage',
  'users.view',
  'users.suspend',
  'users.manage_roles',
  'badges.award',
  'settings.manage',
  'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const BASE: Permission[] = ['community.participate', 'operations.report'];
const STAFF_ALL: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  user: BASE,
  verified_user: BASE,
  editor: [...BASE, 'dashboard.view', 'content.edit'],
  moderator: [
    ...BASE,
    'dashboard.view',
    'operations.validate',
    'community.moderate',
    'reports.manage',
    'forum.manage',
    'users.view',
    'users.suspend',
  ],
  content_manager: [
    ...BASE,
    'dashboard.view',
    'content.edit',
    'content.publish',
    'content.delete',
    'content.feature',
    'operations.validate',
    'operations.manage',
    'badges.award',
  ],
  admin: STAFF_ALL,
  superadmin: STAFF_ALL,
};

export function highestRole(roles: readonly AppRole[]): AppRole {
  return [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0] ?? 'user';
}

export function permissionsFor(roles: readonly AppRole[]): Set<Permission> {
  return new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r]));
}

export function isStaff(roles: readonly AppRole[]): boolean {
  return permissionsFor(roles).has('dashboard.view');
}

/** Mirrors admin_set_role(): roles strictly below your own, superadmin excepted. */
export function grantableRoles(myRoles: readonly AppRole[]): AppRole[] {
  const mine = highestRole(myRoles);
  const all = Object.keys(ROLE_RANK) as AppRole[];
  if (mine === 'superadmin') return all;
  return all.filter((r) => ROLE_RANK[r] < ROLE_RANK[mine]);
}

export function canActOn(myRoles: readonly AppRole[], targetRoles: readonly AppRole[]): boolean {
  return ROLE_RANK[highestRole(myRoles)] > ROLE_RANK[highestRole(targetRoles)];
}
