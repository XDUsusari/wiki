import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { formatDate } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Notícies" };

export default async function NewsPage() {
  await requireMember();
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, kind, pinned, body, created_at, profiles(display_name)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <h1>Notícies i avisos</h1>
      {posts?.length ? posts.map((p) => (
        <article key={p.id} className="card">
          <div className="row">
            {p.pinned && <span className="badge">Fixat</span>}
            {p.kind === "avis" && <span className="badge accent">Avís</span>}
          </div>
          <h3><Link href={`/noticies/${p.id}`}>{p.title}</Link></h3>
          <p className="muted">{formatDate(p.created_at)}</p>
          <p>{p.body.length > 240 ? p.body.slice(0, 240) + "…" : p.body}</p>
        </article>
      )) : <p className="muted">Encara no hi ha notícies.</p>}
    </div>
  );
}
