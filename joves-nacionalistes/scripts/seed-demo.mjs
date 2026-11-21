// Omple un Supabase LOCAL amb dades de demostració (usuaris, anuncis, campanyes, mapa...).
//
//   npm run seed-demo
//
// Per seguretat, es nega a executar-se contra qualsevol Supabase que no sigui local.
// Contrasenya de tots els usuaris de prova: DEMO_PASSWORD (per defecte «Demo-Local-2026!»).

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error("✖ Aquest script només funciona amb un Supabase local (http://127.0.0.1:54321).");
  process.exit(1);
}
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo-Local-2026!";
const db = createClient(url, key, { auth: { persistSession: false } });

const day = 86400000;
const at = (days, hour = 18, min = 0) => {
  const d = new Date(Date.now() + days * day);
  d.setUTCHours(hour - 1, min, 0, 0); // hora de Catalunya (hivern, UTC+1)
  return d.toISOString();
};
const date = (days) => new Date(Date.now() + days * day).toISOString().slice(0, 10);
const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

// ───────── Usuaris ─────────
const PEOPLE = [
  { key: "laia", name: "Laia Ferrer", comarca: "Barcelonès", role: "admin", resp: "Coordinadora del Barcelonès", bio: "Estudiant de Ciència Política a la UB." },
  { key: "pau", name: "Pau Vidal", comarca: "Barcelonès", role: "coordinador", resp: "Responsable de formació", bio: "Mestre. M'encanta organitzar tallers." },
  { key: "nuria", name: "Núria Soler", comarca: "Baix Llobregat", role: "coordinador", resp: "Responsable de comunicació", bio: "Periodista i fotògrafa." },
  { key: "jordi", name: "Jordi Mas", comarca: "Barcelonès", bio: "Enginyer informàtic. Disponible caps de setmana." },
  { key: "marta", name: "Marta Roca", comarca: "Barcelonès", bio: "Infermera a l'Hospital del Mar." },
  { key: "arnau", name: "Arnau Costa", comarca: "Barcelonès", bio: "Jugador de bàsquet i estudiant d'ADE." },
  { key: "clara", name: "Clara Font", comarca: "Vallès Occidental", bio: "Dissenyadora gràfica." },
  { key: "pol", name: "Pol Serra", comarca: "Maresme" },
  { key: "aina", name: "Aina Riera", comarca: "Baix Llobregat", bio: "Advocada en pràctiques." },
  { key: "oriol", name: "Oriol Camps", comarca: "Barcelonès" },
  { key: "julia", name: "Júlia Prat", comarca: "Osona", bio: "Estudiant de Magisteri a Vic." },
  { key: "biel", name: "Biel Torres", comarca: "Barcelonès", status: "pendent" },
];

const ids = {};
const { data: existing } = await db.auth.admin.listUsers({ perPage: 1000 });
for (const p of PEOPLE) {
  const email = `${p.key}@demo.local`;
  let user = existing.users.find((u) => u.email === email);
  if (!user) {
    user = must(await db.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { display_name: p.name, birthdate: "2001-03-15", comarca: p.comarca, privacy_accepted: true, rules_accepted: true },
    }), `usuari ${email}`).user;
  }
  ids[p.key] = user.id;
  must(await db.from("profiles").update({
    role: p.role ?? "membre", status: p.status ?? "actiu", responsibility: p.resp ?? null, bio: p.bio ?? null,
  }).eq("id", user.id), "perfil");
}
console.log(`✔ ${PEOPLE.length} usuaris`);

// Neteja el contingut de demostració anterior (per poder tornar a executar l'script)
for (const t of ["posts", "events", "campaigns", "map_points", "courses", "polls", "proposals", "documents", "messages", "reports"]) {
  must(await db.from(t).delete().not("created_at", "is", null), `neteja ${t}`);
}
const { data: oldFiles } = await db.storage.from("documents").list("demo");
if (oldFiles?.length) await db.storage.from("documents").remove(oldFiles.map((f) => `demo/${f.name}`));

// ───────── Taulell d'anuncis ─────────
must(await db.from("posts").insert([
  { author_id: ids.laia, kind: "avis", pinned: true, title: "Assemblea comarcal del Barcelonès: dissabte 13 de desembre",
    body: "Ens trobem a les 11 h al Casal de Gràcia. Ordre del dia: balanç de l'any, pla d'activitats per al 2027 i elecció de responsables d'àrea.\n\nConfirma l'assistència a l'Agenda." },
  { author_id: ids.nuria, kind: "noticia", title: "Ja tenim el nou logotip!", body: "Gràcies a tothom que va participar a la consulta. El nou logotip ja és a tots els materials i a la intranet." },
  { author_id: ids.pau, kind: "noticia", title: "Nou curs de formació: Comunicació a les xarxes", body: "Ja tens disponible a la secció Formació un curs breu de 4 lliçons sobre com comunicar bé a les xarxes socials." },
  { author_id: ids.laia, kind: "noticia", title: "Balanç de la campanya de recollida d'aliments", body: "Vam recollir més de 1.200 kg d'aliments per al Banc dels Aliments. Moltes gràcies a les 38 persones voluntàries!" },
], { defaultToNull: false }), "anuncis");

// ───────── Agenda ─────────
const events = must(await db.from("events").insert([
  { created_by: ids.laia, title: "Assemblea comarcal del Barcelonès", location: "Casal de Gràcia, Barcelona", comarca: "Barcelonès", starts_at: at(22, 11), ends_at: at(22, 14), capacity: 80,
    description: "Balanç de l'any i pla d'activitats per al 2027." },
  { created_by: ids.pau, title: "Taller d'oratòria", location: "Biblioteca Sant Gervasi, Barcelona", comarca: "Barcelonès", starts_at: at(6, 18, 30), ends_at: at(6, 20, 30), capacity: 20,
    description: "Aprèn a parlar en públic amb seguretat. Places limitades." },
  { created_by: ids.nuria, title: "Sopar de Nadal", location: "Restaurant La Masia, Badalona", comarca: "Barcelonès", starts_at: at(28, 21), capacity: 60,
    description: "Sopar de germanor per tancar l'any." },
], { defaultToNull: false }).select("id, title"), "agenda");
must(await db.from("event_registrations").insert(
  ["laia", "pau", "jordi", "marta", "arnau", "oriol", "nuria"].map((k) => ({ event_id: events[0].id, user_id: ids[k] }))
    .concat(["laia", "marta", "julia"].map((k) => ({ event_id: events[1].id, user_id: ids[k] }))),
), "inscripcions");

// ───────── Voluntariat i campanyes ─────────
const camps = must(await db.from("campaigns").insert([
  { title: "Gran Recapte d'Aliments", comarca: "Barcelonès", starts_on: date(5), ends_on: date(7), created_by: ids.laia,
    description: "Col·laborem amb el Banc dels Aliments en la recollida de productes bàsics als supermercats de Barcelona i l'Hospitalet." },
  { title: "Neteja de la platja del Besòs", comarca: "Barcelonès", starts_on: date(15), ends_on: date(15), created_by: ids.nuria,
    description: "Jornada de neteja de la desembocadura del Besòs amb entitats de Sant Adrià. Portem guants i bosses." },
  { title: "Campanya «Llegim en català»", comarca: "Barcelonès", starts_on: date(1), ends_on: date(40), created_by: ids.pau,
    description: "Parades de llibres de segona mà en català als mercats municipals. Busquem gent per atendre les parades." },
]).select("id"), "campanyes");
const shifts = must(await db.from("volunteer_shifts").insert([
  { campaign_id: camps[0].id, title: "Recollida al supermercat", location: "Mercat de Sant Antoni", starts_at: at(5, 9), ends_at: at(5, 13), slots: 6 },
  { campaign_id: camps[0].id, title: "Recollida al supermercat", location: "Mercat de Sant Antoni", starts_at: at(5, 16), ends_at: at(5, 20), slots: 6 },
  { campaign_id: camps[0].id, title: "Classificació al magatzem", location: "Zona Franca, Barcelona", starts_at: at(7, 10), ends_at: at(7, 14), slots: 10 },
  { campaign_id: camps[1].id, title: "Neteja de la platja", location: "Platja del Fòrum, Sant Adrià", starts_at: at(15, 10), ends_at: at(15, 13), slots: 15 },
  { campaign_id: camps[2].id, title: "Parada de llibres", location: "Mercat de la Concepció", starts_at: at(3, 10), ends_at: at(3, 14), slots: 3 },
  { campaign_id: camps[2].id, title: "Parada de llibres", location: "Mercat de Collblanc, l'Hospitalet", starts_at: at(10, 10), ends_at: at(10, 14), slots: 3 },
]).select("id"), "torns");
const signups = [[0, ["laia", "jordi", "marta", "arnau", "oriol"]], [1, ["pau", "clara"]], [2, ["laia", "aina", "pol", "julia"]],
  [3, ["nuria", "jordi", "arnau", "marta", "oriol", "aina", "laia"]], [4, ["pau", "laia", "julia"]], [5, ["clara"]]];
must(await db.from("shift_signups").insert(signups.flatMap(([i, ks]) => ks.map((k) => ({ shift_id: shifts[i].id, user_id: ids[k] })))), "apuntats");

// ───────── Mapa del Barcelonès ─────────
must(await db.from("map_points").insert([
  { name: "Seu comarcal (exemple)", kind: "seu", municipality: "Barcelona", address: "Carrer de Verdi, Gràcia", lat: 41.4036, lng: 2.1568, description: "Reunions els dimarts a les 19 h." },
  { name: "Plaça de Catalunya", kind: "punt_trobada", municipality: "Barcelona", address: "Plaça de Catalunya", lat: 41.3870, lng: 2.1701, description: "Punt de trobada per a les sortides col·lectives." },
  { name: "Plaça Sant Jaume", kind: "punt_trobada", municipality: "Barcelona", address: "Plaça Sant Jaume", lat: 41.3826, lng: 2.1770 },
  { name: "Mercat de Sant Antoni", kind: "campanya", municipality: "Barcelona", address: "Carrer del Comte d'Urgell, 1", lat: 41.3787, lng: 2.1617, description: "Gran Recapte d'Aliments." },
  { name: "Mercat de la Concepció", kind: "campanya", municipality: "Barcelona", address: "Carrer d'Aragó, 313", lat: 41.3955, lng: 2.1691, description: "Parada «Llegim en català»." },
  { name: "Casal de Gràcia", kind: "activitat", municipality: "Barcelona", address: "Gràcia", lat: 41.4016, lng: 2.1597, description: "Assemblea comarcal." },
  { name: "Mercat de Collblanc", kind: "campanya", municipality: "L'Hospitalet de Llobregat", address: "Carrer de la Riera Blanca", lat: 41.3727, lng: 2.1206 },
  { name: "Rambla Just Oliveras", kind: "punt_trobada", municipality: "L'Hospitalet de Llobregat", address: "Rambla Just Oliveras", lat: 41.3597, lng: 2.0997 },
  { name: "Plaça de la Vila de Badalona", kind: "punt_trobada", municipality: "Badalona", address: "Plaça de la Vila", lat: 41.4500, lng: 2.2474 },
  { name: "Restaurant La Masia (sopar de Nadal)", kind: "activitat", municipality: "Badalona", address: "Badalona", lat: 41.4440, lng: 2.2370 },
  { name: "Plaça de la Vila de Santa Coloma", kind: "punt_trobada", municipality: "Santa Coloma de Gramenet", address: "Plaça de la Vila", lat: 41.4515, lng: 2.2080 },
  { name: "Platja del Fòrum", kind: "campanya", municipality: "Sant Adrià de Besòs", address: "Desembocadura del Besòs", lat: 41.4185, lng: 2.2275, description: "Neteja de la platja." },
].map((p) => ({ ...p, created_by: ids.laia })), { defaultToNull: false }), "mapa");

// ───────── Formació ─────────
const lesson = (title, min, body) => ({ title, duration_min: min, body });
const COURSES = [
  { title: "Benvinguda a l'organització", level: "Inicial", description: "Tot el que necessites saber els primers dies: com funcionem, qui és qui i com participar.", lessons: [
    lesson("Qui som i com ens organitzem", 8, "Som una organització de joves que treballem per territoris. Cada comarca té un equip de coordinació i les decisions importants es prenen en assemblea.\n\nEn aquesta intranet trobaràs tot el necessari per participar."),
    lesson("Com participar a les activitats", 6, "Consulta l'Agenda i apunta't als torns de Voluntariat. Si no pots venir, desapunta't amb temps perquè una altra persona pugui ocupar la plaça."),
    lesson("Normes de convivència", 5, "Respecte, debat d'idees i cap atac personal. Llegeix les normes de la comunitat i fes servir el botó «Denunciar» si veus res inadequat."),
  ] },
  { title: "Comunicació a les xarxes", level: "Intermedi", description: "Com escriure missatges clars, fer bones fotos i cuidar la reputació a les xarxes socials.", lessons: [
    lesson("Escriure un bon missatge", 10, "Un missatge, una idea. Frases curtes, verbs actius i una crida a l'acció clara."),
    lesson("Fotografia amb el mòbil", 12, "Llum natural, regla dels terços i, molt important: demana permís abans de publicar la cara de ningú."),
    lesson("Gestionar comentaris negatius", 8, "No alimentis polèmiques. Respon amb dades i educació, o no responguis."),
    lesson("Seguretat dels comptes", 7, "Activa la verificació en dos passos i no comparteixis mai les contrasenyes."),
  ] },
  { title: "Organitzar un acte pas a pas", level: "Avançat", description: "Des de la idea fins al balanç: permisos, logística, difusió i voluntariat.", lessons: [
    lesson("Planificació i calendari", 15, "Defineix l'objectiu, el públic i la data. Fes un calendari enrere des del dia de l'acte."),
    lesson("Permisos i seguretat", 12, "Consulta l'ajuntament per a l'ocupació de via pública amb temps. Preveu un pla de seguretat i un botiquí."),
  ] },
];
for (const [i, c] of COURSES.entries()) {
  const course = must(await db.from("courses").insert({ title: c.title, level: c.level, description: c.description, position: i }).select("id").single(), "curs");
  const ls = must(await db.from("lessons").insert(c.lessons.map((l, j) => ({ ...l, course_id: course.id, position: j + 1 }))).select("id, position"), "lliçons");
  const doneCount = [3, 2, 0][i];
  const done = ls.sort((a, b) => a.position - b.position).slice(0, doneCount);
  if (done.length) must(await db.from("lesson_progress").insert(done.map((l) => ({ lesson_id: l.id, user_id: ids.laia }))), "progrés");
}

// ───────── Enquestes i consultes ─────────
async function poll(question, description, closesInDays, options, votes) {
  const p = must(await db.from("polls").insert({ question, description, closes_at: at(closesInDays, 23, 59), created_by: ids.laia }).select("id").single(), "consulta");
  const opts = must(await db.from("poll_options").insert(options.map((label, i) => ({ poll_id: p.id, label, position: i }))).select("id, position"), "opcions");
  opts.sort((a, b) => a.position - b.position);
  const rows = Object.entries(votes).map(([k, oi]) => ({ poll_id: p.id, option_id: opts[oi].id, user_id: ids[k] }));
  if (rows.length) {
    must(await db.from("poll_votes").insert(rows), "vots");
  }
  return p.id;
}
await poll("Quin dia preferiu per a les reunions comarcals?", "Volem fixar un dia fix al mes per a les reunions del Barcelonès.", 9,
  ["Dimarts al vespre", "Dijous al vespre", "Dissabte al matí"], { pau: 1, nuria: 1, jordi: 0, marta: 1, arnau: 2, oriol: 1, clara: 2 });
await poll("Quina activitat voleu per a la trobada de primavera?", "", 20,
  ["Excursió a Montserrat", "Jornada esportiva", "Concert i sopar", "Ruta cultural pel Born"], { jordi: 0, aina: 0, pol: 3, julia: 0, marta: 2 });
const closedPoll = await poll("Quin logotip us agrada més?", "Consulta per triar el nou logotip de l'organització.", 2,
  ["Proposta A: «JN» amb muntanya", "Proposta B: escut clàssic", "Proposta C: tipogràfic"],
  { laia: 0, pau: 0, nuria: 0, jordi: 1, marta: 0, arnau: 2, oriol: 0, clara: 0, pol: 1, aina: 0, julia: 0 });
must(await db.from("polls").update({ closes_at: at(-12, 23, 59) }).eq("id", closedPoll), "tancar consulta");

// ───────── Bústia de propostes ─────────
const props = must(await db.from("proposals").insert([
  { author_id: ids.jordi, category: "Activitats", title: "Cicle de cinefòrum en català", body: "Proposo fer un cinefòrum mensual amb pel·lícules en català i un debat posterior. Es podria fer a la seu." },
  { author_id: ids.marta, category: "Formació", title: "Curs de primers auxilis", body: "Seria útil que les persones que fan voluntariat sabessin primers auxilis bàsics. La Creu Roja fa cursos per a entitats." },
  { author_id: ids.clara, category: "Comunicació", title: "Kit de plantilles per a xarxes", body: "Puc preparar plantilles de Canva amb els colors i el logotip perquè cada comarca faci els seus cartells." },
  { author_id: ids.arnau, category: "Activitats", title: "Lliga de bàsquet 3x3 entre comarques", body: "Un torneig esportiu ajudaria a conèixer gent d'altres comarques." },
  { author_id: ids.pol, category: "Organització", title: "Compartir cotxe per anar als actes", body: "Una secció per organitzar viatges compartits des de les comarques més allunyades." },
]).select("id"), "propostes");
must(await db.from("proposals").update({ status: "acceptada", response: "Molt bona idea! La Clara coordinarà el kit; el tindrem a Documents al gener." }).eq("id", props[2].id), "resposta");
must(await db.from("proposals").update({ status: "en_estudi", response: "Estem demanant pressupost a la Creu Roja." }).eq("id", props[1].id), "resposta");
const sup = { 0: ["laia", "marta", "arnau", "oriol", "julia", "aina"], 1: ["laia", "pau", "jordi", "aina", "oriol", "pol", "clara", "nuria"], 2: ["nuria", "laia", "jordi"], 3: ["jordi", "oriol"], 4: ["julia", "pol", "clara", "aina"] };
must(await db.from("proposal_supports").insert(Object.entries(sup).flatMap(([i, ks]) => ks.map((k) => ({ proposal_id: props[i].id, user_id: ids[k] })))), "suports");

// ───────── Documents ─────────
function pdf(title, lines) {
  const esc = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/·/g, ".").replace(/[()\\]/g, "\\$&");
  const text = [`BT /F1 20 Tf 60 770 Td (${esc(title)}) Tj ET`, ...lines.map((l, i) => `BT /F1 12 Tf 60 ${730 - i * 20} Td (${esc(l)}) Tj ET`)].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n"; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
const DOCS = [
  { title: "Guia d'acollida per a nous membres", category: "Guies", description: "Tot el que cal saber per començar", lines: ["Benvinguda!", "1. Com ens organitzem", "2. Com participar", "3. Contactes"] },
  { title: "Protocol de voluntariat", category: "Guies", description: "Normes i bones pràctiques als torns", lines: ["Puntualitat", "Avisar si no pots venir", "Respecte a les persones ateses"] },
  { title: "Acta de l'assemblea d'octubre", category: "Actes i reunions", description: "Acords i tasques pendents", lines: ["Assistents: 42", "Acord 1: calendari de campanyes", "Acord 2: nou logotip"] },
  { title: "Cartell Gran Recapte (A3)", category: "Materials de campanya", description: "Per imprimir", lines: ["GRAN RECAPTE D'ALIMENTS", "Col.labora!"] },
  { title: "Dossier del curs d'oratòria", category: "Formació", description: "Material de suport del taller", lines: ["Respiracio", "Estructura del discurs", "Llenguatge corporal"] },
];
for (const [i, d] of DOCS.entries()) {
  const file = pdf(d.title, d.lines);
  const path = `demo/${i + 1}-${d.title.normalize("NFKD").replace(/[^\w]+/g, "_").toLowerCase()}.pdf`;
  must(await db.storage.from("documents").upload(path, file, { contentType: "application/pdf", upsert: true }), "pujada");
  must(await db.from("documents").insert({ title: d.title, description: d.description, category: d.category, file_path: path,
    file_name: path.split("/").pop(), mime_type: "application/pdf", size_bytes: file.length, uploaded_by: ids.laia }), "document");
}

// ───────── Fòrum ─────────
const { data: chans } = await db.from("channels").select("id, slug");
const ch = Object.fromEntries(chans.map((c) => [c.slug, c.id]));
const msgs = [
  ["anuncis", "laia", "Recordeu que dissabte 13 hi ha assemblea comarcal. Apunteu-vos a l'Agenda!"],
  ["general", "jordi", "Bon dia! Algú sap si el taller d'oratòria es farà en català o també en castellà?"],
  ["general", "pau", "Tot en català, Jordi 😊 Encara queden places."],
  ["general", "marta", "Jo m'hi he apuntat. Ens veiem allà!"],
  ["general", "arnau", "Per al Gran Recapte necessitem més gent dissabte a la tarda, qui s'anima?"],
  ["general", "clara", "Compta amb mi per a la tarda!"],
  ["propostes", "pol", "He penjat una proposta per compartir cotxe des del Maresme, doneu-li suport si us sembla bé."],
];
for (const [slug, k, body] of msgs) must(await db.from("messages").insert({ channel_id: ch[slug], author_id: ids[k], body }), "missatge");

console.log("✔ Contingut de demostració creat");
console.log(`\n  Entra amb laia@demo.local (admin) o jordi@demo.local (membre) · contrasenya: ${PASSWORD}\n`);
