# ADR-0009 — Asistente MANU con núcleo determinista y modelos opcionales

Status: **ACCEPTED**  
Date: **2026-09-28**  
Relacionado: **ADR-0004** (coste cero), **ADR-0006** (agentes opcionales con aprobación)

## Contexto

Manu quiere que la pestaña central de MANU OS sea un chat personal («MANU»), con personalidad parecida a Chatty: cercana, natural, sincera, capaz de llevarle la contraria y de tomar la iniciativa varias veces al día.

A la vez se mantienen estas condiciones, confirmadas por Manu el 2026-09-28:

- **0 € de coste adicional** y ninguna facturación automática (ADR-0004).
- MANU BRAIN independiente del proveedor (ADR-0006).
- Organización, memoria, búsqueda y automatizaciones deben seguir funcionando **sin IA**.

Hechos que condicionan la decisión:

- Manu tiene ChatGPT Plus, Claude Pro y Gemini Pro. Son **suscripciones de consumo**: no equivalen necesariamente a acceso por API para una app propia, y no hay que tratarlas como si lo fueran.
- Según Apple, Apple Intelligence necesita iPhone 15 Pro o posterior y Mac con Apple silicon. **El iPhone 14 y el Mac Intel de Manu no son compatibles**, así que los modelos locales de Apple no están disponibles.
- Una conversación natural y abierta, con matices de personalidad, requiere un modelo de lenguaje. Sin modelo, un chat solo puede ser estructurado.

## Decisión

1. **El chat MANU es la interfaz de conversación con MANU BRAIN, no un modelo.** Funciona en dos niveles:
   - **Nivel base (siempre disponible, sin IA)**: comandos y frases reconocidas de forma determinista (capturar, registrar un gasto, buscar, consultar agenda, preparar la alarma, abrir la bandeja de capturas…), recuperación con fuentes, plantillas de respuesta con tono cercano y sugerencias proactivas basadas en reglas y patrones aprendidos localmente.
   - **Nivel conversacional (opcional)**: un proveedor de modelo conectado mediante `AgentAdapter`, solo cuando exista una ruta con coste 0 € verificada y aceptada por Manu, o cuando Manu decida explícitamente pagar una API (D-08).
2. **Puente con apps oficiales**: para tareas complejas, MANU prepara el contexto mínimo necesario, lo muestra, y abre la app oficial (ChatGPT, Claude o Gemini) para que Manu lo pegue o lo comparta. No se automatiza el uso de esas apps ni de sus cuentas.
3. **Datos protegidos frente a proveedores externos**: una opción gratuita externa **nunca** recibe salud, finanzas, estado emocional, chats privados ni transcripciones sin una decisión específica de Manu y una revisión de sus condiciones de uso y privacidad. Lo mismo aplica a cualquier proveedor de pago.
4. **Personalidad**: el tono (cercano, sincero, sin positividad artificial, sin exceso de estadísticas, sin repetirse) es un requisito del producto en ambos niveles. En el nivel base se implementa con plantillas variadas y reglas de frecuencia; no se promete la misma naturalidad que un modelo.
5. **Proactividad**: MANU puede iniciar conversaciones varias veces al día. Aprende los momentos adecuados a partir de sugerencias aceptadas, rechazadas e ignoradas, de forma local, explicable y reversible. Respeta Focus, un presupuesto diario de interrupciones y la regla de no preguntar constantemente.
6. **Acciones**:
   - acciones pequeñas previamente autorizadas y rutinas repetitivas autorizadas: automáticas, con registro y deshacer cuando sea posible;
   - acciones con consecuencias: MANU las prepara y pide confirmación;
   - mensajes: MANU redacta, abre la app adecuada y deja el envío preparado. Solo los mensajes de una **lista blanca explícita** pueden enviarse automáticamente. El único caso admitido hoy como candidato es avisar de que Manu ha llegado, y su viabilidad técnica está `NO_VERIFICADO`.
   - MANU nunca suplanta a Manu ni envía otros mensajes automáticamente.

## Consecuencias

- La Beta 1 no puede prometer un chat del nivel de ChatGPT sin una fuente de modelo decidida (D-08). El contrato de la beta distingue lo que funciona sin IA.
- `ARCHITECTURE.md` añade un motor de conversación determinista, un motor de proactividad y un registro de sugerencias.
- Se añaden los riesgos de calidad conversacional, de proactividad molesta y de exposición de datos sensibles a proveedores.
- ADR-0006 sigue vigente: gateway, contexto mínimo, auditoría y aprobación de escrituras.

## Alternativas consideradas

- **Chat conectado a una API de pago**: posible solo con decisión explícita de Manu, porque rompe «0 € adicionales». Queda en D-08.
- **Usar las suscripciones de consumo como si fueran API**: rechazada; no es una ruta soportada por los proveedores y pondría en riesgo las cuentas de Manu.
- **Modelos locales de Apple**: no disponibles en los dispositivos actuales de Manu.
- **Modelo local abierto en el Mac Intel**: no descartado, pero `NO_VERIFICADO` y probablemente lento en un i5 de doble núcleo; se estudia dentro de D-08.

## Verificación

Nada de este ADR está implementado. La compatibilidad de Apple Intelligence procede de la documentación de Apple consultada el 2026-09-28 (ver `docs/research/SOURCES.md`).
