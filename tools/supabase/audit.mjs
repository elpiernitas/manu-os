// Read-only security audit of MANU's Supabase (WEB-99). Pure: it judges the rows that three
// SELECTs over the Postgres catalog return. Used by desplegar.mjs before and after any change.
export const AUDIT_SQL = {
  rls: "select c.relname as table, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1",
  grants: "select table_name as table, grantee, privilege_type as privilege from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated') order by 1, 2, 3",
  policies: "select tablename as table, policyname as name, roles::text as roles, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2",
};

// What anon (the public key in the app) may do: only leave a line in the Shortcut's inbox.
const ANON_ALLOWED = new Set(["manu_inbox:INSERT"]);
// Tables only the server (service_role) may touch.
const SERVER_ONLY = new Set(["manu_push_keys", "manu_push_cron", "manu_bank_ais"]);
const OWNED = ["manu_sync", "manu_push_subs", "manu_push_queue", "manu_inbox_owner"];

/** Returns { ok, findings: [{ level: "error"|"warn", text }] }. */
export function auditFindings({ rls = [], grants = [], policies = [] }) {
  const f = [];
  for (const t of rls) if (!t.rls) f.push({ level: "error", text: `La tabla ${t.table} no tiene RLS.` });
  for (const g of grants) {
    if (g.grantee === "anon" && !ANON_ALLOWED.has(`${g.table}:${g.privilege}`)) f.push({ level: "error", text: `anon (la clave pública) tiene ${g.privilege} en ${g.table}.` });
    if (SERVER_ONLY.has(g.table)) f.push({ level: "error", text: `${g.grantee} tiene ${g.privilege} en ${g.table}, que solo debe leer el servidor.` });
  }
  const tables = new Set(rls.map((t) => t.table));
  for (const t of OWNED) {
    if (!tables.has(t)) continue;
    const ps = policies.filter((p) => p.table === t);
    if (!ps.length) f.push({ level: "warn", text: `${t} no tiene políticas: nadie puede usarla (RLS sin reglas).` });
    for (const p of ps) if (!/auth\.uid\(\)/.test(`${p.qual ?? ""} ${p.with_check ?? ""}`)) f.push({ level: "error", text: `La política «${p.name}» de ${t} no limita por usuario (auth.uid()).` });
  }
  for (const p of policies) if (/\banon\b/.test(p.roles) && !(p.table === "manu_inbox" && p.cmd === "INSERT")) f.push({ level: "error", text: `La política «${p.name}» de ${p.table} se aplica a anon.` });
  return { ok: !f.some((x) => x.level === "error"), findings: f };
}

/** Billing guard: only the free plan with no paid add-ons may be touched. */
export function billingGuard({ org, addons }) {
  const why = [];
  if (org?.plan !== "free") why.push(`La organización está en el plan «${org?.plan ?? "desconocido"}», no en el gratuito.`);
  if ((addons?.selected_addons ?? []).length) why.push(`Hay complementos de pago contratados: ${addons.selected_addons.map((a) => a.type).join(", ")}.`);
  return { ok: why.length === 0, why };
}
