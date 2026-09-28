# 08 — Decisiones y puntos abiertos

## Decisiones cerradas por BRAIN-00

- PWA primero; app nativa no es requisito.
- Arquitectura local-first con sync al estar activa.
- Cifrado de contenido en cliente antes de cloud sync.
- MANU BRAIN independiente de ChatGPT, Claude y Gemini.
- Modelo relacional + proyección de grafo; no Neo4j.
- Búsqueda textual primero; embeddings después y opcionales.
- Event log incremental; no CRDT genérico en MVP.
- Fuentes brutas inmutables; derivados regenerables.
- Google Drive appData es candidato preferido para backup/sync cifrado de coste cero, no acceso amplio a Drive.
- Cloudflare Worker/D1 es despliegue de referencia para servicio mínimo, no contrato del núcleo.
- R2 y servicios con cobro por exceso quedan fuera hasta verificar un límite duro.
- HOME, MIND y MIRROR se construyen después de Capture, evidencia, búsqueda y restore.
- El primer trabajo de Claude es el contrato temporal/evidencial con tests.

## Contradicciones resueltas

- «Conectar todas mis apps» se interpreta como una estrategia por rutas reales, no acceso automático universal.
- «PWA de altísima calidad» no implica que una PWA pueda usar frameworks nativos de Apple.
- «Coste 0 €» prevalece sobre integración inmediata con APIs que requieren billing o Developer Program.
- «Gemelo digital» significa representación informacional con fuentes, no imitación consciente ni voz autónoma.
- «Claude implementa» no convierte créditos temporales en dependencia del producto.

## Supuestos que deben validarse durante implementación

- Safari/iOS real conserva correctamente el vault dentro del patrón de uso de Manu.
- Atajos puede entregar de forma cómoda los tipos de captura elegidos.
- El flujo de Google OAuth puede pasar de Testing a producción con `drive.appdata` sin fricción relevante.
- El rendimiento de IndexedDB/OPFS es suficiente para el tamaño inicial.
- La frase/secreto de recuperación ofrece una UX aceptable.
- El ranking contextual de HOME aporta utilidad sin IA.

## Intervención de Manu necesaria ahora

Solo una acción personal es necesaria para comenzar BRAIN-01:

- crear o elegir el **repositorio privado de GitHub MANU OS** y conceder acceso al flujo de Claude Code.

No hacen falta todavía API keys, OAuth de Google, Apple Developer, tarjeta, dominio ni exportaciones personales.

## Intervenciones futuras, no ahora

- autorizar scopes Google uno por uno;
- probar instalación/Atajo en iPhone;
- guardar de forma segura el secreto de recuperación;
- decidir si una integración sensible aporta suficiente valor;
- aprobar cualquier servicio con coste;
- aportar exports reales solo cuando importador, cifrado y backup estén preparados.

## Riesgos técnicos principales

1. Pérdida/evicción de almacenamiento web si no existe backup probado.
2. UX del cifrado demasiado pesada en PWA.
3. OAuth y verificaciones Google más complejos que la API técnica.
4. Expectativas de integración Apple mayores que lo permitido por el sistema.
5. Prompt injection al incorporar correo y documentos.
6. Modelo de datos demasiado genérico o demasiado rígido.
7. Sync conflictivo entre iPhone y Mac.
8. Deriva del proyecto hacia IA llamativa antes de resolver captura y recuperación.
9. Dependencias de frontend con acceso al vault desbloqueado.
10. Falta de pruebas reales de restore.

Cada riesgo tiene un gate correspondiente en el roadmap.
