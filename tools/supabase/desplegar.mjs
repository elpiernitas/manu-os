#!/usr/bin/env node
// Despliegue de MANU OS en su Supabase (WEB-99), sin pegar SQL ni tocar el panel.
//
//   node tools/supabase/desplegar.mjs              → solo comprueba (plan, estado, seguridad). No cambia nada.
//   node tools/supabase/desplegar.mjs --aplicar    → además aplica las migraciones y despliega la función.
//   node tools/supabase/desplegar.mjs --aplicar --restaurar   → y reactiva el proyecto si está pausado.
//
// Necesita SUPABASE_ACCESS_TOKEN (Account → Access Tokens de Supabase). En la nube de Claude lo
// inyecta el proxy; en el Mac: SUPABASE_ACCESS_TOKEN=sbp_… node tools/supabase/desplegar.mjs
// Se detiene ante cualquier riesgo de facturación (plan que no sea «free» o complementos de pago)
// y ante cualquier fallo de la auditoría de seguridad. Nunca imprime ni guarda secretos.
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { auditFindings, billingGuard, AUDIT_SQL } from "./audit.mjs";

const REF = "xqsexjpuhvmwkclpnvjo";
const ORG = "wgeunssmtjscardpsjdc";
const API = "https://api.supabase.com/v1";
const args = new Set(process.argv.slice(2));
const apply = args.has("--aplicar"), restore = args.has("--restaurar");
const token = process.env.SUPABASE_ACCESS_TOKEN ?? "proxy-injected";
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const say = (...x) => console.log(...x);
const stop = (msg) => { console.error(`\n✋ ${msg}\nNo se ha cambiado nada más.`); process.exit(1); };

async function api(path, init = {}) {
  const r = await fetch(`${API}${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const text = await r.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw Object.assign(new Error(`${init.method ?? "GET"} ${path}: ${r.status} ${typeof body === "string" ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`), { status: r.status });
  return body;
}
const sql = (query) => api(`/projects/${REF}/database/query`, { method: "POST", body: JSON.stringify({ query }) });

async function audit(label) {
  const [rls, grants, policies] = [await sql(AUDIT_SQL.rls), await sql(AUDIT_SQL.grants), await sql(AUDIT_SQL.policies)];
  const r = auditFindings({ rls, grants, policies });
  say(`\n🔒 Auditoría de seguridad (${label}): ${rls.length} tablas, ${policies.length} políticas.`);
  for (const t of rls) say(`   ${t.rls ? "✅" : "❌"} ${t.table}: RLS ${t.rls ? "activado" : "DESACTIVADO"}`);
  for (const x of r.findings) say(`   ${x.level === "error" ? "❌" : "⚠️"} ${x.text}`);
  if (!r.findings.length) say("   Sin hallazgos.");
  return r;
}

say("MANU OS · despliegue en Supabase", apply ? "(aplicando)" : "(solo comprobación)");
const [org, project] = [await api(`/organizations/${ORG}`), await api(`/projects/${REF}`)];
const addons = await api(`/projects/${REF}/billing/addons`);
const guard = billingGuard({ org, addons });
say(`Plan: ${org.plan} · complementos de pago: ${(addons.selected_addons ?? []).length} · proyecto ${project.name}: ${project.status}`);
if (!guard.ok) stop(`Riesgo de facturación:\n - ${guard.why.join("\n - ")}`);

if (project.status !== "ACTIVE_HEALTHY") {
  if (!(apply && restore)) stop(`El proyecto está ${project.status}. Para reactivarlo (gratis en el plan free): --aplicar --restaurar`);
  say("Reactivando el proyecto (gratis en el plan free)…");
  await api(`/projects/${REF}/restore`, { method: "POST", body: "{}" });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const p = await api(`/projects/${REF}`);
    say(`   estado: ${p.status}`);
    if (p.status === "ACTIVE_HEALTHY") break;
    if (i === 59) stop("El proyecto no ha vuelto en 10 minutos. Mira el panel de Supabase.");
  }
}

const before = await audit("antes");
if (!before.ok) stop("La auditoría ha encontrado problemas de seguridad: se corrigen antes de añadir nada.");
if (!apply) { say("\nTodo comprobado. Para aplicar: --aplicar"); process.exit(0); }

// Migrations: idempotent files, applied in order. The base one is only re-applied if it is missing.
const dir = new URL("../../supabase/migrations/", import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  if (f.includes("_base")) {
    const t = await sql("select to_regclass('public.manu_sync') is not null as ok");
    if (t[0]?.ok) { say(`↷ ${f}: ya existe (creado a mano), no se toca.`); continue; }
  }
  say(`→ Migración ${f}`);
  await sql(readFileSync(new URL(f, dir), "utf8"));
}

// The function: deployed with the Supabase CLI (server-side bundling, no Docker).
say("→ Función manu-push");
execFileSync("npx", ["-y", "supabase@2", "functions", "deploy", "manu-push", "--project-ref", REF, "--no-verify-jwt", "--use-api"], { stdio: "inherit", cwd: new URL("../../", import.meta.url).pathname, env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN ?? `sbp_${"0".repeat(40)}` /* placeholder: the proxy injects the real one */, ...(process.env.NODE_EXTRA_CA_CERTS ? { SSL_CERT_FILE: process.env.NODE_EXTRA_CA_CERTS } : {}) } });

const after = await audit("después");
if (!after.ok) stop("La auditoría posterior ha fallado: revisa los hallazgos (los avisos no se usan hasta corregirlo).");
const cron = await sql("select jobname, schedule, active from cron.job where jobname = 'manu-push'");
say(`\n⏱  Cron: ${cron.length ? `${cron[0].jobname} ${cron[0].schedule} (${cron[0].active ? "activo" : "inactivo"})` : "NO encontrado"}`);
say("En 1–2 minutos la función crea sus claves. Luego, en MANU: Tú → Avisos → «Activar en este dispositivo».");
