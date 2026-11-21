import Link from "next/link";
import { notFound } from "next/navigation";
import ChatRoom, { type ChatMessage } from "@/components/ChatRoom";
import { isStaff, requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await requireMember();
  const supabase = await createClient();
  const { data: channel } = await supabase
    .from("channels").select("id, name, description, staff_only_post").eq("slug", slug).maybeSingle();
  if (!channel) notFound();

  const { data } = await supabase
    .from("messages")
    .select("id, body, created_at, author_id, profiles(display_name)")
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const initial = ((data ?? []) as unknown as ChatMessage[]).reverse();
  const staff = isStaff(me);

  return (
    <div>
      <div className="row spread">
        <h1 style={{ marginBottom: 0 }}># {channel.name}</h1>
        <Link href="/forum">← Canals</Link>
      </div>
      <p className="muted">{channel.description}</p>
      <ChatRoom
        channelId={channel.id}
        initial={initial}
        meId={me.id}
        canPost={!channel.staff_only_post || staff}
        isStaff={staff}
      />
    </div>
  );
}
