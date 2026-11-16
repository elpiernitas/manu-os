# Tablero de marketing en MANU, solo lectura (WEB-116)

Manu solo usa de la app de su empresa el Tablero de marketing, y quiere verlo en MANU. MANU **solo
lee**: no mueve, no crea y no borra tarjetas.

## Camino de los datos

```
MANU (navegador) ──POST + sesión de Tu nube──▶ manu-tablero (Supabase de Manu)
                                                   │  GET + token de solo lectura
                                                   ▼
                                     feed de lectura (app de la empresa)
```

- La dirección del feed y el token están solo en los secretos del Supabase de Manu (`RK_TABLERO_URL`,
  `RK_TABLERO_TOKEN`). No están en el navegador, ni en el repositorio, ni en el chat.
- `manu-tablero` solo atiende a la sesión de Tu nube de Manu y solo hace GET al feed.
- Lo que llega se valida y se recorta dos veces, en el servidor (`tablero-core.js`) y en el
  navegador (`web/core/tablero.js`). Una prueba comprueba que las dos copias limpian igual.
- La copia se guarda solo en este dispositivo (`localStorage` aparte, fuera del vault). No va a Tu
  nube, ni a las copias de seguridad, ni a ninguna IA.

## Contrato v1 del feed

```json
{ "version": 1, "generatedAt": "ISO", "openUrl": "https://… (opcional)",
  "cards": [{ "id": "≤64 [A-Za-z0-9_-]", "title": "≤140", "column": "EN_MENTE|POR_HACER|HACIENDO|ESPERANDO_OK|ESPERANDO_COMERCIAL|HECHO",
              "due": "YYYY-MM-DD (opcional)", "updatedAt": "ISO (opcional)", "requestedBy": "comercial|propio (opcional)", "estimateMin": 1-600 }] }
```

- Como mucho 200 tarjetas.
- Las tarjetas Hecho, solo las de los últimos 7 días.
- Nada de descripciones, comentarios, clientes, teléfonos ni correos. Si se cuela un teléfono o un
  correo en un título, MANU lo tapa.

## En MANU

- **Hoy**, solo cuando se ve el trabajo (laborables, de la mañana al cierre de jornada):
  - lo vencido sale como urgente;
  - lo que vence hoy y lo que está en Haciendo, como importante;
  - lo que espera al OK o al comercial y la carga estimada, como «para saber».
  - Cada fila dice «Tablero RK · leído a las…». Al cerrar la jornada desaparece hasta el día laborable siguiente.
- **Tú → Tablero RK**: activar, leer ahora, abrir el Tablero, ver las columnas activas y borrar la copia.
- Se lee al abrir MANU en horario de trabajo, como mucho cada 10 minutos.

## Para conectarlo (pendiente)

1. En la app de la empresa: un feed de solo lectura que cumpla el contrato, con un token propio.
   Prompt para su sesión de Claude Code: lo tiene Manu.
2. En el Supabase de Manu (panel de Supabase, nunca en el chat): los secretos `RK_TABLERO_URL` y
   `RK_TABLERO_TOKEN`.
3. Publicar `manu-tablero` en el Supabase de Manu, solo con su autorización expresa.
4. En MANU: Tú → Tablero RK → «Leer mi Tablero».

Hasta entonces, MANU dice «Pendiente» y no simula nada.
