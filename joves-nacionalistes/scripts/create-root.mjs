// Crea el compte d'administrador principal («root») de la intranet.
//
//   npm run create-root
//
// Variables (a .env.local):
//   ROOT_EMAIL     correu del compte root (obligatori)
//   ROOT_PASSWORD  contrasenya inicial (opcional; si no hi és, se'n genera una d'aleatòria)
//
// La contrasenya inicial és temporal: el primer cop que s'entra, l'app obliga a canviar-la.

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ROOT_EMAIL;

if (!url || !serviceKey) fail("Falten NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY a .env.local");
if (!email) fail("Defineix ROOT_EMAIL a .env.local (ex: ROOT_EMAIL=root@el-teu-domini.cat)");

const WEAK = ["root", "admin", "password", "contrasenya", "123456", "qwerty"];
let password = process.env.ROOT_PASSWORD;
if (password) {
  if (password.length < 12) fail("ROOT_PASSWORD ha de tenir almenys 12 caràcters.");
  if (WEAK.some((w) => password.toLowerCase().includes(w))) fail("ROOT_PASSWORD és massa fàcil d'endevinar.");
} else {
  password = randomBytes(18).toString("base64url");
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: {
    display_name: "root",
    birthdate: "1970-01-01",
    privacy_accepted: true,
    rules_accepted: true,
  },
});
if (error) fail(`No s'ha pogut crear l'usuari: ${error.message}`);

const { error: profileError } = await supabase
  .from("profiles")
  .update({ role: "admin", status: "actiu", must_change_password: true })
  .eq("id", data.user.id);
if (profileError) fail(`Usuari creat, però no s'ha pogut fer admin: ${profileError.message}`);

console.log("\n✔ Compte root creat\n");
console.log(`  Correu:      ${email}`);
if (!process.env.ROOT_PASSWORD) console.log(`  Contrasenya: ${password}   (temporal, apunta-la ara: no es tornarà a mostrar)`);
console.log("\n  En entrar per primer cop, l'app et demanarà una contrasenya nova.\n");

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}
