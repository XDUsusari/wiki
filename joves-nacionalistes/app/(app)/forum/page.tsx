import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Fòrum" };

export default async function ForumPage() {
  await requireMember();
  const supabase = await createClient();
  const { data: channels } = await supabase
    .from("channels").select("slug, name, description, staff_only_post").order("name");

  return (
    <div>
      <h1>Fòrum</h1>
      <div className="grid">
        {channels?.map((c) => (
          <Link key={c.slug} href={`/forum/${c.slug}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <h3># {c.name}</h3>
            <p className="muted">{c.description}</p>
            {c.staff_only_post && <span className="badge">Només lectura</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
