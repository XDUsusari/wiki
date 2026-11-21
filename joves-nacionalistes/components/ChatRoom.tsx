"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ChatMessage = {
  id: number;
  body: string;
  created_at: string;
  author_id: string;
  profiles: { display_name: string } | null;
};

const SELECT = "id, body, created_at, author_id, profiles(display_name)";

function time(iso: string) {
  return new Intl.DateTimeFormat("ca-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" })
    .format(new Date(iso));
}

export default function ChatRoom({
  channelId, initial, meId, canPost, isStaff,
}: {
  channelId: string;
  initial: ChatMessage[];
  meId: string;
  canPost: boolean;
  isStaff: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sub = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const { data } = await supabase.from("messages").select(SELECT).eq("id", payload.new.id).maybeSingle();
          if (data) {
            const msg = data as unknown as ChatMessage;
            setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
          }
        },
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        const id = (payload.old as { id?: number }).id;
        if (id != null) setMessages((m) => m.filter((x) => x.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [supabase, channelId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const { data, error } = await supabase
      .from("messages").insert({ channel_id: channelId, author_id: meId, body }).select(SELECT).single();
    setSending(false);
    if (error) return setError(error.message.includes("Massa") ? error.message : "No s'ha pogut enviar el missatge.");
    setText("");
    const msg = data as unknown as ChatMessage;
    setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
  }

  async function remove(id: number) {
    if (!confirm("Esborrar aquest missatge?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) return setError("No s'ha pogut esborrar.");
    setMessages((m) => m.filter((x) => x.id !== id));
  }

  async function report(id: number) {
    const reason = prompt("Per què denuncies aquest missatge?");
    if (!reason || reason.trim().length < 3) return;
    const { error } = await supabase
      .from("reports").insert({ message_id: id, reporter_id: meId, reason: reason.trim(), message_snapshot: "" });
    setError(error ? "No s'ha pogut enviar la denúncia." : null);
    if (!error) alert("Gràcies. La coordinació revisarà el missatge.");
  }

  return (
    <div className="chat">
      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.length === 0 && <p className="muted">Encara no hi ha missatges. Comença la conversa!</p>}
        {messages.map((m) => {
          const mine = m.author_id === meId;
          return (
            <div key={m.id} className={`msg${mine ? " mine" : ""}`}>
              <header>
                <strong>{m.profiles?.display_name ?? "Membre"}</strong>
                <span className="muted">{time(m.created_at)}</span>
              </header>
              <div className="prose">{m.body}</div>
              <div className="actions">
                {(mine || isStaff) && <button className="secondary" onClick={() => remove(m.id)}>Esborrar</button>}
                {!mine && <button className="secondary" onClick={() => report(m.id)}>Denunciar</button>}
              </div>
            </div>
          );
        })}
      </div>
      {error && <div className="alert error">{error}</div>}
      {canPost ? (
        <form className="chat-form" onSubmit={send}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={2000}
            placeholder="Escriu un missatge…"
            aria-label="Missatge"
          />
          <button type="submit" disabled={sending || !text.trim()}>Enviar</button>
        </form>
      ) : (
        <p className="muted">En aquest canal només hi pot publicar la coordinació.</p>
      )}
    </div>
  );
}
