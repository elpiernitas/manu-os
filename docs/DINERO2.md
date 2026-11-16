# Dinero 2.0 · Entender tu dinero de verdad (WEB-111)

Estado: **publicado en la versión 111** (autorizado por Manu en la misión «de prototipo a asistente
personal real»). Antes de fusionar se corrigieron las cuatro cosas que pidió: una sola fuente de verdad,
coherencia de las devoluciones, niveles de confianza e interacción en iPhone.

## Principio

Los movimientos del banco (`vault.spending`, `vault.income`) **no se modifican nunca**. Lo que Manu dice
de ellos se guarda aparte, en `vault.ledger`:

| Parte | Qué guarda |
|---|---|
| `notes[clave]` | Qué es el movimiento para Manu: tipo, nombre, categoría, reparto, uso del efectivo, notas. Guarda hasta 10 versiones anteriores (`prev`) |
| `links[id]` | Relaciones entre dos movimientos, **confirmadas o descartadas por Manu**. Nunca se crean solas |
| `debts[id]` | Deudas apuntadas a mano (pagó otra persona por mí, o un saldo puesto a cero) |
| `dropped[...]` | Marcas de lo deshecho, para que Tu nube no lo resucite desde otro dispositivo |

La clave de un movimiento es `g:<id>` (gasto) o `i:<id>` (ingreso). Los ids son los de siempre, estables
entre importaciones: una anotación sobrevive a reimportar el extracto o a «Importar todo (90 días)».

## Tipos

| Tipo | Si sale dinero | Si entra dinero |
|---|---|---|
| Gasto o ingreso propio | Consumo tuyo | Ingreso propio |
| Dinero de otra persona | Gastado de su dinero (puedes dejar una parte tuya, en € o %) | Dinero suyo en tu cuenta (p. ej., de tu madre) |
| Gasto compartido | Pagaste tú: tu parte es consumo; la de los demás, te la deben | — |
| Entre mis cuentas | Neutro | Neutro |
| Efectivo | Retirada: tú dices si lo gastaste, lo tienes en mano o lo volviste a ingresar | Ingreso de efectivo: neutro |
| Devolución | — | Rebaja la compra relacionada o, sin relacionar, tus compras anteriores de su categoría (90 días) |
| Pago de una deuda | Le pagas a alguien lo que le debías | Alguien te paga lo que te debía |
| Pendiente de revisar | No cuenta ni como tuyo ni como de nadie | Igual |

## Lo que MANU supone sin preguntar

- **Compras normales** (tarjeta, recibos…): consumo tuyo, marcado como «supuesto».
- **Nómina y manutención**: ingreso propio.
- **Retiradas de cajero, Bizum y transferencias** (enviados o recibidos), **ingresos de efectivo** y
  **devoluciones sin relacionar**: **pendientes**. No son consumo ni ingreso hasta que Manu lo diga.
- Nunca supone que algo es de otra persona.
- Los repartos antiguos (`entry.split`) se siguen leyendo como gasto compartido; lo ya pagado no cuenta.

## Relaciones sugeridas (nunca automáticas)

- **Efectivo que volví a ingresar.** Una retirada y un ingreso posterior, como mucho 45 días después y por
  un importe igual o menor.
  - Con ingreso de efectivo: confianza **alta** si el importe es igual y han pasado 15 días o menos;
    **media** en otro caso.
  - Sin ingreso de efectivo: solo si el importe es exacto y han pasado 10 días o menos, con confianza
    **baja** y el aviso «solo coincide el importe: no lo doy por hecho».
- **Devolución de una compra.** Un ingreso de tipo devolución, una compra anterior (como mucho 90 días
  antes) con una palabra del comercio en común, y un importe igual o menor.
- **Traspaso entre cuentas.** El mismo importe, 3 días o menos de diferencia, y los dos conceptos dicen
  traspaso o «entre cuentas».

Cada sugerencia muestra sus motivos. «Sí» la confirma y «No» la descarta. En ambos casos no se vuelve a
proponer, y se puede deshacer desde la ficha.

## Las cifras

Para un periodo:

- **Movimientos del banco**: todo lo que salió y entró, tal cual.
- **Consumo personal**: tu parte de cada gasto, con las devoluciones ya descontadas de su compra.
  - Una devolución relacionada rebaja esa compra.
  - Sin relacionar, rebaja tus compras anteriores de la misma categoría, la más reciente primero y como
    mucho 90 días antes. Lo que no encuentra compra sale como «Devoluciones sin compra» y no rebaja nada.
- **Ingresos propios**: los ingresos tuyos, y tu parte si una parte es de otra persona.
- **Dinero de otras personas**: lo suyo que entró y salió por tu cuenta.
- **Neutros**: traspasos, efectivo devuelto y devoluciones ya aplicadas a su compra.
- **Pendiente de atribuir**: lo que no has revisado y no se puede suponer.
- **Ahorro personal** = ingresos propios − consumo personal. Nunca incluye dinero de otros ni lo pendiente.
- **Fiable** si lo pendiente es como mucho el **5 %** de lo que se ha movido.
  - Si no es fiable: el ahorro sale como «—», y se suspenden la previsión de fin de mes, «tu día de más
    gasto», los avisos de presupuesto de Hoy, los comentarios de gasto de las revisiones de la noche y de
    la semana, y la comparación con el mes pasado en las respuestas de MANU.
- **Nivel de confianza** de la cifra, siempre visible en el resumen:
  - **Confirmada por ti**: todo lo que cuenta lo has revisado y no queda nada pendiente.
  - **Interpretada por MANU**: fiable, pero incluye compras supuestas o algo pendiente (por debajo del 5 %).
  - **Provisional**: más del 5 % pendiente.
  - **Sin datos**: no hay movimientos en el periodo.
  Una cifra con movimientos supuestos nunca sale como confirmada.

Las estadísticas de siempre (media diaria, serie de 6 meses, «Dónde gastas», «Lo que más se repite»,
patrones, presupuestos y el resumen de Hoy) se calculan ahora sobre **tu consumo y tus ingresos**, no
sobre el banco en bruto. También las revisiones de la noche y de la semana, la respuesta de MANU a
«¿cuánto he gastado?» y el contexto que se manda a Gemini si lo autorizas. Las pruebas comprueban que el
resumen, las categorías y la serie suman lo mismo en todos los casos.

## Saldos con personas

Positivo: dinero suyo que tienes o que le debes. Negativo: te debe.

Suman a ese saldo:
- su parte de los gastos compartidos;
- el dinero suyo que entra o que gastas;
- los pagos de deudas;
- las deudas apuntadas a mano.

«Dejar a cero» apunta un ajuste sin tocar ningún movimiento.

## Tu nube y varios dispositivos

`mergeLedger` une el ledger de los dos dispositivos:
- de cada anotación gana la versión más reciente, y la otra pasa a su historial;
- lo deshecho no vuelve si su marca es más reciente;
- fusionar dos veces da el mismo resultado.

Se aplica al bajar los datos (`applyRemote`) y al resolver un conflicto quedándose con los de este
dispositivo.

## Qué cambia en la app

- **Dinero**, arriba: «Tu dinero de verdad», con el aviso de cifras provisionales y el botón «Revisar
  pendientes».
- Sugerencias de relaciones.
- **Ficha de cada movimiento** (toca cualquiera, gasto o ingreso):
  - concepto original del banco;
  - nombre editable, tipo, categoría y reparto (personas, € o %, a partes iguales);
  - uso del efectivo, notas e importe personal atribuible;
  - relaciones e historial con «Restaurar»;
  - «Volver a lo que dice el banco».
- **Corregir varios**: eliges movimientos, tipo o categoría, ves el antes y el después y confirmas.
- **Con otras personas**: saldos, deudas a mano y «Dejar a cero».
- El reparto de «¿Con quién estabas?» guarda una anotación en lugar de escribir en el movimiento.
- Se corrige el nombre en vertical («Luisssss») del reparto detallado.
- Lo apuntado a mano se puede borrar desde su ficha. Lo del banco, no.

## Pendiente o fuera de este cambio

- **Reglas automáticas por comercio** («los Bizum a Mamá son siempre suyos»): no están. Cada caso se
  anota o se corrige en grupo.
- **Cambiar la categoría desde la ficha no enseña la regla de categorías** (`learnCategory`), como hacía la
  fila antigua. Se puede añadir si lo quieres.
- **Safari e iPhone reales: no probados.**
