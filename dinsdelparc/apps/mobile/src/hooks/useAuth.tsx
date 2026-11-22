import { permissionsFor, type AppRole, type Permission, type Profile } from '@dinsdelparc/shared';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isBackendConfigured } from '../lib/env';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  ready: boolean;
  session: Session | null;
  userId: string | null;
  emailVerified: boolean;
  profile: Profile | null;
  roles: AppRole[];
  suspendedUntil: string | null;
  can: (permission: Permission) => boolean;
  /** Authenticated, verified, not suspended. Mirrors SQL can_participate(). */
  canParticipate: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isBackendConfigured);
  const qc = useQueryClient();

  useEffect(() => {
    if (!isBackendConfigured) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) qc.removeQueries({ queryKey: ['me'] });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  const userId = session?.user.id ?? null;

  const me = useQuery({
    queryKey: ['me', userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profile, roles, moderation] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId!).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId!),
        supabase.from('user_moderation').select('suspended_until').eq('user_id', userId!).maybeSingle(),
      ]);
      if (profile.error) throw new Error(profile.error.message);
      return {
        profile: profile.data as Profile,
        roles: (roles.data ?? []).map((r) => r.role as AppRole),
        suspendedUntil: (moderation.data?.suspended_until as string | null) ?? null,
      };
    },
  });

  const suspendedUntil =
    me.data?.suspendedUntil && Date.parse(me.data.suspendedUntil) > Date.now() ? me.data.suspendedUntil : null;
  const roles = useMemo(() => me.data?.roles ?? [], [me.data?.roles]);
  const perms = useMemo(() => permissionsFor(roles), [roles]);
  const emailVerified = !!session?.user.email_confirmed_at;

  const can = useCallback((p: Permission) => !!userId && !suspendedUntil && perms.has(p), [perms, suspendedUntil, userId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      userId,
      emailVerified,
      profile: me.data?.profile ?? null,
      roles,
      suspendedUntil,
      can,
      canParticipate: can('community.participate') && emailVerified,
      refreshProfile: async () => {
        await qc.invalidateQueries({ queryKey: ['me'] });
      },
      signOut: async () => {
        await supabase.auth.signOut();
        qc.removeQueries({ queryKey: ['me'] });
        qc.removeQueries({ queryKey: ['favorites'] });
        qc.removeQueries({ queryKey: ['plans'] });
        qc.removeQueries({ queryKey: ['plan'] });
        qc.removeQueries({ queryKey: ['notifications'] });
      },
    }),
    [ready, session, userId, emailVerified, me.data?.profile, roles, suspendedUntil, can, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
