# ADR-0004 — Coste operativo cero sin cobros automáticos

Status: **ACCEPTED**  
Date: **2026-09-28**

## Contexto

MANU OS debe poder funcionar sin suscripciones de backend, consumo obligatorio de IA ni Apple Developer Program. Un free tier con facturación automática por exceso no cumple por sí solo la restricción.

## Decisión

El modo base funciona localmente y sin IA. Los servicios remotos se activan solo cuando exista una cuota gratuita suficiente y una barrera de gasto comprobada. Ante agotamiento de cuota, la función se pausa y la app sigue operativa localmente.

## Consecuencias

- No se habilitan servicios de pago ni métodos de facturación sin decisión explícita de Manu.
- Cada adaptador remoto documenta límites, degradación y estrategia de salida.
- Los créditos temporales de Claude u otro proveedor no influyen en la arquitectura.
- El coste forma parte de los acceptance criteria.

## Alternativas rechazadas

- Diseñar primero para un backend de pago y «optimizar después».
- Hacer obligatorias APIs de IA para clasificar o buscar.
