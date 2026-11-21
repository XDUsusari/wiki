const madridFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Madrid", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** Diferència (ms) entre l'hora de Catalunya i UTC en un instant donat. */
function madridOffset(ms: number) {
  const p = Object.fromEntries(madridFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** L'input datetime-local («2026-05-01T18:30») no porta zona: s'interpreta com a hora de Catalunya. */
export function toIso(local: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = guess - madridOffset(guess);
  utc = guess - madridOffset(utc); // corregeix canvis d'horari d'estiu
  return new Date(utc).toISOString();
}
