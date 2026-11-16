#!/usr/bin/env node
// Contrato de .claude/skills (PR #122). Sin dependencias.
// - cada skill tiene SKILL.md con `name` igual a su carpeta y `description`;
// - el mapa de usa-ecc lista exactamente las skills incluidas;
// - usa-ecc prohíbe ejecutar paquetes remotos y escáneres que envían el repo
//   a terceros (security-scan propone `npx ecc-agentshield`).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", ".claude", "skills");
const errors = [];

const dirs = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
for (const d of dirs) {
  const file = join(root, d, "SKILL.md");
  if (!existsSync(file)) { errors.push(`${d}: falta SKILL.md`); continue; }
  const fm = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) { errors.push(`${d}: sin frontmatter`); continue; }
  const name = fm[1].match(/^name:\s*(.+)$/m)?.[1].trim();
  const desc = fm[1].match(/^description:\s*(.+)$/m)?.[1].trim();
  if (name !== d) errors.push(`${d}: name «${name}» no coincide con la carpeta`);
  if (!desc) errors.push(`${d}: falta description`);
}

const router = readFileSync(join(root, "usa-ecc", "SKILL.md"), "utf8");
const map = router.split(/^## Mapa\s*$/m)[1] ?? "";
const listed = new Set(
  map.split("\n").filter((l) => l.startsWith("**"))
    .flatMap((l) => l.replace(/^\*\*[^*]+\*\*/, "").split(","))
    .map((s) => s.replace(/\(.*?\)/g, "").trim()).filter(Boolean),
);
const skills = new Set(dirs.filter((d) => d !== "usa-ecc"));
for (const s of skills) if (!listed.has(s)) errors.push(`usa-ecc: el mapa no incluye ${s}`);
for (const s of listed) if (!skills.has(s)) errors.push(`usa-ecc: el mapa cita ${s}, que no existe`);

const rules = router.split(/^## Mapa\s*$/m)[0];
for (const needle of ["npx", "ecc-agentshield", "a terceros"]) {
  if (!rules.includes(needle)) errors.push(`usa-ecc: falta la regla sobre paquetes remotos («${needle}»)`);
}
if (!existsSync(join(root, "ECC_LICENSE"))) errors.push("falta ECC_LICENSE");

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`OK: ${skills.size} skills de ECC + usa-ecc`);
