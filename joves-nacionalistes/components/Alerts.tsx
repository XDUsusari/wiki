export default function Alerts({ error, ok }: { error?: string; ok?: string }) {
  return (
    <>
      {error && <div className="alert error" role="alert">{error}</div>}
      {ok && <div className="alert ok" role="status">{ok}</div>}
    </>
  );
}

export type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export async function readAlerts(searchParams: SearchParams) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return { error: one(sp.error), ok: one(sp.ok), next: one(sp.next) };
}
