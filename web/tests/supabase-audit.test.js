// WEB-99 — la auditoría de seguridad y el freno de facturación del despliegue. Datos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import { auditFindings, billingGuard } from "../../tools/supabase/audit.mjs";

const good = {
  rls: ["manu_sync", "manu_inbox", "manu_inbox_owner", "manu_push_subs", "manu_push_queue", "manu_push_keys", "manu_push_cron"].map((table) => ({ table, rls: true })),
  grants: [{ table: "manu_inbox", grantee: "anon", privilege: "INSERT" }, { table: "manu_sync", grantee: "authenticated", privilege: "SELECT" }, { table: "manu_push_subs", grantee: "authenticated", privilege: "DELETE" }],
  policies: [
    { table: "manu_sync", name: "solo lo mio", roles: "{authenticated}", cmd: "ALL", qual: "(user_id = ( SELECT auth.uid() AS uid))", with_check: "(user_id = ( SELECT auth.uid() AS uid))" },
    { table: "manu_inbox", name: "atajo deja", roles: "{anon}", cmd: "INSERT", qual: null, with_check: "true" },
    { table: "manu_push_subs", name: "solo mis suscripciones", roles: "{authenticated}", cmd: "ALL", qual: "(user_id = ( SELECT auth.uid() AS uid))", with_check: "(user_id = ( SELECT auth.uid() AS uid))" },
    { table: "manu_push_queue", name: "solo mi cola", roles: "{authenticated}", cmd: "ALL", qual: "(user_id = ( SELECT auth.uid() AS uid))", with_check: "(user_id = ( SELECT auth.uid() AS uid))" },
    { table: "manu_inbox_owner", name: "dueño de su código", roles: "{authenticated}", cmd: "ALL", qual: "(user_id = auth.uid())", with_check: "(user_id = auth.uid())" },
  ],
};

test("the expected configuration passes", () => {
  const r = auditFindings(good);
  assert.ok(r.ok, JSON.stringify(r.findings));
});

test("each kind of leak is caught", () => {
  const bad = (patch) => auditFindings({ ...good, ...patch });
  assert.ok(!bad({ rls: [...good.rls, { table: "nueva", rls: false }] }).ok, "a table without RLS");
  assert.ok(!bad({ grants: [...good.grants, { table: "manu_sync", grantee: "anon", privilege: "SELECT" }] }).ok, "anon reading the vault");
  assert.ok(!bad({ grants: [...good.grants, { table: "manu_push_keys", grantee: "authenticated", privilege: "SELECT" }] }).ok, "the app reading private keys");
  assert.ok(!bad({ policies: [...good.policies, { table: "manu_push_queue", name: "abierta", roles: "{authenticated}", cmd: "SELECT", qual: "true", with_check: null }] }).ok, "a policy not limited by user");
  assert.ok(!bad({ policies: [...good.policies, { table: "manu_sync", name: "x", roles: "{anon}", cmd: "SELECT", qual: "(user_id = auth.uid())" }] }).ok, "a policy for anon");
});

test("billing guard: only the free plan without paid add-ons", () => {
  assert.ok(billingGuard({ org: { plan: "free" }, addons: { selected_addons: [] } }).ok);
  assert.ok(!billingGuard({ org: { plan: "pro" }, addons: { selected_addons: [] } }).ok);
  assert.match(billingGuard({ org: { plan: "free" }, addons: { selected_addons: [{ type: "custom_domain" }] } }).why.join(), /custom_domain/);
  assert.ok(!billingGuard({ org: null, addons: null }).ok, "unknown is not free");
});
