import 'server-only';

type Level = 'info' | 'warn' | 'error';

/** Structured JSON logs (picked up by the hosting platform's log drain). Never log secrets or tokens. */
export function log(level: Level, event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, app: 'dinsdelparc-admin', event, ...data });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}
