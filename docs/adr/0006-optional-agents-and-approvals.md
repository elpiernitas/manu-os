# ADR-0006 — Agentes opcionales con aprobación de escrituras

Status: **ACCEPTED**  
Date: **2026-09-28**

## Contexto

ChatGPT, Claude, Gemini y modelos futuros pueden ayudar a interpretar el corpus, pero ninguno debe poseer MANU BRAIN ni ejecutar acciones externas por defecto. Los documentos y correos pueden contener prompt injection.

## Decisión

Los agentes acceden mediante un gateway con contexto mínimo, allowlists, auditoría y adaptadores sustituibles. Las lecturas pueden automatizarse dentro de scopes aprobados. Las escrituras sobre conocimiento producen propuestas; mensajes, borrados, publicaciones y otras acciones externas requieren aprobación explícita.

MCP será una interfaz opcional, no el almacén.

## Consecuencias

- MANU OS sigue siendo útil sin proveedor de IA.
- El sistema registra qué fragmentos se enviaron, a quién y con qué propósito.
- Las instrucciones encontradas dentro del corpus se tratan como datos.
- Cambiar de modelo no requiere migrar el cerebro.

## Alternativas rechazadas

- Dar al modelo acceso completo al vault.
- Permitir escritura o comunicación autónoma por conveniencia.
