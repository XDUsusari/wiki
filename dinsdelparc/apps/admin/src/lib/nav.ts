import type { Permission, TKey } from '@dinsdelparc/shared';

export interface NavItem {
  href: string;
  label: TKey;
  icon: string;
  permission: Permission;
}

export const NAV: NavItem[] = [
  { href: '/', label: 'admin.nav.dashboard', icon: '◧', permission: 'dashboard.view' },
  { href: '/content', label: 'admin.nav.content', icon: '▤', permission: 'content.edit' },
  { href: '/operations', label: 'admin.nav.operations', icon: '⏱', permission: 'operations.validate' },
  { href: '/moderation', label: 'admin.nav.moderation', icon: '⚑', permission: 'community.moderate' },
  { href: '/reports', label: 'admin.nav.reports', icon: '✉', permission: 'reports.manage' },
  { href: '/users', label: 'admin.nav.users', icon: '☺', permission: 'users.view' },
  { href: '/forum', label: 'admin.nav.forum', icon: '☰', permission: 'forum.manage' },
  { href: '/gamification', label: 'admin.nav.gamification', icon: '★', permission: 'badges.award' },
  { href: '/settings', label: 'admin.nav.settings', icon: '⚙', permission: 'settings.manage' },
  { href: '/audit', label: 'admin.nav.audit', icon: '⎘', permission: 'audit.view' },
];

export function visibleNav(perms: Set<Permission>): NavItem[] {
  return NAV.filter((n) => perms.has(n.permission));
}
