import type { WaitTimeReport } from '@dinsdelparc/shared';
import { supabase, unwrap } from '../lib/supabase';

export async function submitWaitReport(attractionId: string, minutes: number): Promise<WaitTimeReport> {
  return unwrap(
    await supabase.from('waiting_time_reports').insert({ attraction_id: attractionId, minutes }).select('*').single(),
  ) as WaitTimeReport;
}

export async function fetchWaitHistory(attractionId: string, hours = 6) {
  return unwrap(await supabase.rpc('attraction_wait_history', { p_attraction: attractionId, p_hours: hours })) as {
    bucket: string;
    median_minutes: number;
    reports: number;
  }[];
}
