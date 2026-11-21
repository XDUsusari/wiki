import Link from "next/link";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { isStaff, requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createCourse } from "../modules-actions";

export const metadata = { title: "Formació" };

export default async function TrainingPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const { error, ok } = await readAlerts(searchParams);
  const supabase = await createClient();
  const [{ data: courses }, { data: progress }] = await Promise.all([
    supabase.from("courses").select("id, title, description, level, lessons(id, duration_min)").order("position").order("created_at"),
    supabase.from("lesson_progress").select("lesson_id").eq("user_id", me.id),
  ]);
  const done = new Set((progress ?? []).map((p) => p.lesson_id));
  const totalDone = done.size;
  const completedCourses = (courses ?? []).filter((c) => c.lessons.length && c.lessons.every((l) => done.has(l.id))).length;

  return (
    <div>
      <h1>🎓 Formació</h1>
      <p className="lead">Cursos breus per créixer com a activista i com a equip.</p>
      <Alerts error={error} ok={ok} />

      <div className="stat-row">
        <div className="stat"><b>{courses?.length ?? 0}</b>Cursos disponibles</div>
        <div className="stat"><b>{totalDone}</b>Lliçons completades</div>
        <div className="stat"><b>{completedCourses}</b>Cursos acabats</div>
      </div>

      {isStaff(me) && (
        <details className="staff-box">
          <summary>＋ Nou curs</summary>
          <form action={createCourse}>
            <div className="field"><label htmlFor="co-title">Títol</label><input id="co-title" name="title" required minLength={3} /></div>
            <div className="field"><label htmlFor="co-desc">Descripció</label><textarea id="co-desc" name="description" /></div>
            <div className="field" style={{ maxWidth: 220 }}>
              <label htmlFor="co-level">Nivell</label>
              <select id="co-level" name="level"><option>Inicial</option><option>Intermedi</option><option>Avançat</option></select>
            </div>
            <button type="submit">Crear curs</button>
          </form>
        </details>
      )}

      <div className="grid">
        {courses?.map((c) => {
          const total = c.lessons.length;
          const mine = c.lessons.filter((l) => done.has(l.id)).length;
          const pct = total ? Math.round((mine / total) * 100) : 0;
          const minutes = c.lessons.reduce((n, l) => n + (l.duration_min ?? 0), 0);
          return (
            <Link key={c.id} href={`/formacio/${c.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="row spread">
                <span className="badge">{c.level}</span>
                {pct === 100 && <span className="badge accent">✓ Completat</span>}
              </div>
              <h3 style={{ marginTop: 10 }}>{c.title}</h3>
              <p className="muted">{c.description}</p>
              <div className="progress"><div style={{ width: `${pct}%` }} /></div>
              <p className="muted" style={{ margin: "6px 0 0" }}>{mine}/{total} lliçons · {minutes} min</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
