export const APP_NAME = "Joves Nacionalistes";

export const COMARQUES = [
  "Alt Camp", "Alt Empordà", "Alt Penedès", "Alt Urgell", "Alta Ribagorça", "Anoia", "Aran",
  "Bages", "Baix Camp", "Baix Ebre", "Baix Empordà", "Baix Llobregat", "Baix Penedès",
  "Barcelonès", "Berguedà", "Cerdanya", "Conca de Barberà", "Garraf", "Garrigues", "Garrotxa",
  "Gironès", "Lluçanès", "Maresme", "Moianès", "Montsià", "Noguera", "Osona", "Pallars Jussà",
  "Pallars Sobirà", "Pla d'Urgell", "Pla de l'Estany", "Priorat", "Ribera d'Ebre", "Ripollès",
  "Segarra", "Segrià", "Selva", "Solsonès", "Tarragonès", "Terra Alta", "Urgell",
  "Vallès Occidental", "Vallès Oriental",
] as const;

export function formatDate(iso: string, withTime = true) {
  return new Intl.DateTimeFormat("ca-ES", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

/** Converteix l'error de Supabase/Postgres en un missatge per a l'usuari. */
export function friendlyError(message: string | undefined) {
  if (!message) return "Hi ha hagut un error. Torna-ho a provar.";
  if (message.includes("duplicate key")) return "Ja existeix.";
  if (message.includes("row-level security")) return "No tens permís per fer això.";
  return message.replace(/^.*?ERROR:\s*/, "").slice(0, 200);
}
