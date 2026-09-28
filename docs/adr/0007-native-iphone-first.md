# ADR-0007 — Experiencia nativa de iPhone como prioridad

Status: **ACCEPTED**  
Date: **2026-09-28**  
Sustituye: **ADR-0001** (en lo relativo a la interfaz principal y al calendario de la app nativa)

## Contexto

ADR-0001 eligió una PWA local-first como primera interfaz y dejó una app nativa como «companion futuro», condicionada al gate G-05 (dos capacidades valiosas imposibles por PWA/Atajos).

La visión de MANU OS ha cambiado. MANU OS pasa a ser una **capa visual y operativa sobre el iPhone**: el teléfono debe adaptarse a momentos del día (mañana, trabajo, fuera del trabajo, fin de semana) y ofrecer información y accesos directamente en las superficies del sistema. Los casos de uso descubiertos (ver `docs/product/PRODUCT_CHARTER.md`, sección «Casos de uso descubiertos») dependen de capacidades que una PWA no ofrece en iOS:

- widgets de pantalla de inicio y de pantalla bloqueada;
- App Intents (Atajos, Siri, botón de acción);
- controles del Centro de Control;
- Live Activities;
- adaptación a los modos de concentración (Focus) del sistema;
- acceso nativo con permiso a calendario, recordatorios, fotos, micrófono y reconocimiento de voz.

Con esta visión, el gate G-05 ya se cumple por definición de producto: widgets, App Intents, Live Activities y controles del Centro de Control no están disponibles para una PWA.

## Decisión

1. La **app nativa de iPhone (Swift/SwiftUI)** es la experiencia principal de MANU OS y aparece desde las primeras fases del roadmap, no después del MVP.
2. La app principal es el **cerebro y centro de configuración**: gestiona el vault, los modos, los permisos y las integraciones.
3. Las superficies del sistema (widgets, pantalla bloqueada, Centro de Control, botón de acción, Live Activities, App Intents) son **extensiones** de esa app y leen un subconjunto mínimo de datos preparado para ellas.
4. Los **modos** (mañana, trabajo, fuera del trabajo, fin de semana, y otros que se definan) cambian información, accesos, pantallas y comportamiento **dentro de MANU OS y de sus extensiones**. MANU OS no sustituye el launcher ni modifica globalmente iOS; donde haga falta un cambio del sistema (silenciar apps o contactos), se apoya en los mecanismos que iOS pone en manos del usuario, como los Focus configurados por Manu, y lo documenta como tal.
5. El componente web/local-first **puede mantenerse** si resulta útil como cerebro compartido, panel o compañero para Mac, pero no bloquea ni pospone la experiencia nativa de iPhone.
6. Siguen vigentes sin cambios: independencia de ChatGPT/Claude/Gemini (ADR-0006), conocimiento con evidencia (ADR-0002), cifrado en cliente (ADR-0003), aprobación antes de escrituras sensibles (ADR-0006) y ausencia de facturación automática (ADR-0004).

## Decisiones que este ADR deja abiertas

Se registran en `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`:

- **D-01**: qué parte será SwiftUI nativa y qué parte, si existe, seguirá siendo web (incluido el lenguaje del núcleo MANU BRAIN: Swift, TypeScript o ambos con contrato compartido).
- **D-02**: almacenamiento local en iOS y cómo se comparte con las extensiones.
- **D-03**: si se asume el coste de Apple Developer Program. Es una suscripción explícita, no un cobro automático por exceso, pero choca con el objetivo de coste 0 € de ADR-0004 y requiere decisión de Manu.
- **D-04**: entorno de compilación y pruebas de la app iOS, que requiere Xcode en un Mac.

## Consecuencias

- ADR-0001 pasa a `SUPERSEDED`. Su contenido se conserva para trazabilidad.
- El roadmap, el backlog, el contrato del MVP, la arquitectura y la matriz de integraciones se reordenan para que la app nativa aparezca pronto.
- El gate G-05 («no app nativa sin dos capacidades imposibles por PWA») queda retirado y se sustituye por gates de permisos, finanzas y grabaciones.
- BRAIN-01 sigue `NOT_AUTHORIZED`. Su especificación (TypeScript + Zod) debe revalidarse contra D-01 antes de autorizarse.
- Aumentan los riesgos de permisos del sistema, límites de iOS, distribución/aprovisionamiento y exposición de datos en superficies visibles con el teléfono bloqueado (ver `docs/security/RISK_REGISTER.md` y `docs/security/THREAT_MODEL.md`).
- Local-first sigue siendo requisito: la app nativa debe funcionar sin red y sin IA.

## Alternativas consideradas

- **Mantener ADR-0001 (PWA primero, nativa después)**: rechazada; no permite widgets, App Intents, Live Activities ni controles, que son el núcleo de la nueva visión.
- **App nativa que reemplaza por completo cualquier componente web**: no se decide todavía; queda como opción dentro de D-01.
- **Envolver la PWA en un contenedor nativo (WebView) como experiencia principal**: no se elige como dirección; las superficies del sistema se construyen igualmente en SwiftUI/WidgetKit, así que el contenedor no ahorra la parte nativa. Puede reconsiderarse dentro de D-01 para pantallas concretas.

## Verificación

Nada de este ADR está implementado ni probado. Todas las capacidades de iOS citadas son `TEÓRICAMENTE_POSIBLE` hasta probarlas en el iPhone de Manu, con la versión de iOS y el tipo de cuenta de desarrollador que se usen.

## Notas posteriores (2026-09-28)

Añadidas tras las decisiones de producto de Manu del mismo día. No cambian la decisión de este ADR; precisan su aplicación:

- **Botón de acción**: según Apple, solo lo tienen iPhone 15 Pro, 15 Pro Max y la serie 16 o posterior. El dispositivo actual de Manu es un **iPhone 14, que no lo tiene**. El acceso rápido a MANU se hará desde el Centro de Control, la pantalla bloqueada y, como alternativa `NO_VERIFICADO`, Toque posterior (Accesibilidad) con un Atajo.
- **Mac**: MANU OS incluye también una app para Mac con las mismas capacidades que la de iPhone (ver `docs/product/EXPERIENCE.md`). El reparto entre SwiftUI y web sigue en D-01, con recomendación documentada en `docs/architecture/DECISIONS_AND_OPEN_ITEMS.md`.
- **Apariencia**: los modos cambian contenido, accesos y comportamiento, no colores, fondos ni widgets. La identidad visual es estable durante todo el día.
- **Referencia trasladada**: la sección «Casos de uso descubiertos» citada en el Contexto ya no está en el Product Charter; su contenido, ampliado, está en `docs/product/EXPERIENCE.md`.
