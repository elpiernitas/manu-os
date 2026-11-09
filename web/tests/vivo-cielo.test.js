// HORIZONTE (prototipo web/vivo): el cielo, la luz y el contraste del sistema de diseño.
import test from "node:test";
import assert from "node:assert/strict";
import { sol, cielo, contraste, variables, TOKENS, TIEMPOS } from "../vivo/src/cielo.js";

test("el sol de Gijón: alto a mediodía de verano, bajo el horizonte a medianoche", () => {
  const junio = sol(new Date(Date.UTC(2026, 5, 21, 12, 25)));
  assert.ok(junio.elevacion > 68 && junio.elevacion < 71, `elevación ${junio.elevacion}`);
  assert.ok(sol(new Date(Date.UTC(2026, 5, 21, 0, 0))).elevacion < 0);
  assert.ok(sol(new Date(Date.UTC(2026, 10, 9, 9, 0))).angulo < 0, "por la mañana el ángulo horario es negativo");
});

test("las fases siguen al sol y el astro cambia de sol a luna", () => {
  assert.equal(cielo(new Date(Date.UTC(2026, 10, 9, 12))).fase, "dia");
  assert.equal(cielo(new Date(Date.UTC(2026, 10, 9, 23))).fase, "noche");
  assert.equal(cielo(new Date(Date.UTC(2026, 10, 9, 23))).astro.tipo, "luna");
  assert.equal(cielo(new Date(Date.UTC(2026, 10, 9, 17))).fase, "ocaso");
  assert.equal(cielo(new Date(Date.UTC(2026, 10, 9, 7))).fase, "alba");
  assert.equal(cielo(new Date(), "granizo").tiempo, "despejado", "un tiempo desconocido no rompe nada");
});

test("los pares de color del sistema cumplen WCAG AA (4,5:1) en los dos temas", () => {
  for (const [tema, t] of Object.entries(TOKENS)) {
    for (const fondo of [t.papel, t.papel2]) {
      assert.ok(contraste(t.tinta, fondo) >= 4.5, `${tema}: tinta sobre ${fondo}`);
      assert.ok(contraste(t.tinta2, fondo) >= 4.5, `${tema}: tinta secundaria sobre ${fondo}`);
      assert.ok(contraste(t.boyaTinta, fondo) >= 4.5, `${tema}: acento como texto sobre ${fondo}`);
    }
    assert.ok(contraste(t.sobreBoya, t.boya) >= 4.5, `${tema}: texto sobre la boya`);
  }
});

test("a cualquier hora y con cualquier tiempo, la cabecera se lee sobre el cielo (3:1, texto grande)", () => {
  for (const tiempo of TIEMPOS) for (let h = 0; h < 24; h += 0.5) {
    const c = cielo(new Date(Date.UTC(2026, 10, 9, Math.floor(h), (h % 1) * 60)), tiempo);
    const tinta = TOKENS[c.oscuro ? "noche" : "dia"].tinta;
    assert.ok(contraste(tinta, c.colores.arriba) >= 3, `${tiempo} ${h}h: ${contraste(tinta, c.colores.arriba).toFixed(2)}`);
    for (const v of Object.values(variables(c))) assert.match(String(v), /^(#[0-9a-f]{6}|[01](\.\d+)?)$/);
  }
});
