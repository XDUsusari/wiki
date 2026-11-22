import type { ReportReason, ReportTarget } from '@dinsdelparc/shared';
import { supabase, unwrap } from '../lib/supabase';

export async function createReport(targetType: ReportTarget, targetId: string, reason: ReportReason, details: string | null) {
  unwrap(await supabase.from('reports').insert({ target_type: targetType, target_id: targetId, reason, details: details || null }));
}
