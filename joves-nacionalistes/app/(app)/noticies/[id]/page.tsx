import Link from "next/link";
import { notFound } from "next/navigation";
import { isStaff, requireMember } from "@/lib/auth";
import { formatDate } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { deletePost } from "../../actions";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember();
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id, title, kind, body, created_at, profiles(display_name)")
    .eq("id", id)
    .maybeSingle();
  if (!post) notFound();
  const author = (post.profiles as unknown as { display_name: string } | null)?.display_name;

  return (
    <article className="card">
      {post.kind === "avis" && <span className="badge accent">Avís</span>}
      <h1 style={{ marginTop: 8 }}>{post.title}</h1>
      <p className="muted">{formatDate(post.created_at)}{author ? ` · ${author}` : ""}</p>
      <div className="prose">{post.body}</div>
      <div className="row spread" style={{ marginTop: 16 }}>
        <Link href="/noticies">← Totes les notícies</Link>
        {isStaff(me) && (
          <form action={deletePost}>
            <input type="hidden" name="id" value={post.id} />
            <button className="danger small" type="submit">Esborrar</button>
          </form>
        )}
      </div>
    </article>
  );
}
