import Link from "next/link";
import { notFound } from "next/navigation";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { isStaff, requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createLesson, toggleLesson } from "../../modules-actions";

type Lesson = { id: string; position: number; title: string; body: string; duration_min: number | null };

export default async function CoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { error, ok } = await readAlerts(searchParams);
  const me = await requireMember();
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses").select("id, title, description, level, lessons(id, position, title, body, duration_min)").eq("id", id).maybeSingle();
  if (!course) notFound();
  const lessons = (course.lessons as Lesson[]).sort((a, b) => a.position - b.position);
  const { data: progress } = await supabase.from("lesson_progress").select("lesson_id").eq("user_id", me.id)
    .in("lesson_id", lessons.map((l) => l.id));
  const done = new Set((progress ?? []).map((p) => p.lesson_id));

  const requested = typeof sp.lesson === "string" ? sp.lesson : undefined;
  const current = lessons.find((l) => l.id === requested) ?? lessons.find((l) => !done.has(l.id)) ?? lessons[0];
  const idx = current ? lessons.indexOf(current) : -1;
  const next = idx >= 0 ? lessons[idx + 1] : undefined;
  const pct = lessons.length ? Math.round((done.size / lessons.length) * 100) : 0;

  return (
    <div>
      <Link href="/formacio">← Tots els cursos</Link>
      <h1 style={{ marginTop: 12 }}>{course.title}</h1>
      <p className="lead">{course.level} · {lessons.length} lliçons · {pct}% completat</p>
      <div className="progress" style={{ marginBottom: 16 }}><div style={{ width: `${pct}%` }} /></div>
      <Alerts error={error} ok={ok} />

      <div className="course-layout">
        <nav className="card lesson-list" aria-label="Lliçons">
          {lessons.map((l, i) => (
            <Link key={l.id} href={`/formacio/${course.id}?lesson=${l.id}`} className={l.id === current?.id ? "current" : ""}>
              <span className={`check-dot${done.has(l.id) ? " done" : ""}`}>{done.has(l.id) ? "✓" : i + 1}</span>
              <span style={{ flex: 1 }}>{l.title}</span>
              {l.duration_min && <small>{l.duration_min} min</small>}
            </Link>
          ))}
          {!lessons.length && <p className="muted">Aquest curs encara no té lliçons.</p>}
        </nav>

        {current && (
          <article className="card">
            <p className="muted" style={{ marginTop: 0 }}>Lliçó {idx + 1} de {lessons.length}</p>
            <h2>{current.title}</h2>
            <div className="prose">{current.body}</div>
            <div className="row" style={{ marginTop: 20 }}>
              <form action={toggleLesson}>
                <input type="hidden" name="lesson_id" value={current.id} />
                <input type="hidden" name="course_id" value={course.id} />
                <input type="hidden" name="done" value={done.has(current.id) ? "1" : "0"} />
                <button type="submit" className={done.has(current.id) ? "secondary" : ""}>
                  {done.has(current.id) ? "✓ Completada · Desmarcar" : "Marcar com a completada"}
                </button>
              </form>
              {next && <Link className="btn secondary" href={`/formacio/${course.id}?lesson=${next.id}`}>Següent lliçó →</Link>}
            </div>
          </article>
        )}
      </div>

      {isStaff(me) && (
        <details className="staff-box" style={{ marginTop: 16 }}>
          <summary>＋ Afegir lliçó</summary>
          <form action={createLesson}>
            <input type="hidden" name="course_id" value={course.id} />
            <div className="field"><label htmlFor="l-title">Títol</label><input id="l-title" name="title" required minLength={3} /></div>
            <div className="field"><label htmlFor="l-body">Contingut</label><textarea id="l-body" name="body" required style={{ minHeight: 200 }} /></div>
            <div className="field" style={{ maxWidth: 160 }}><label htmlFor="l-min">Durada (min)</label><input id="l-min" name="duration_min" type="number" min={1} /></div>
            <button type="submit">Afegir lliçó</button>
          </form>
        </details>
      )}
    </div>
  );
}
