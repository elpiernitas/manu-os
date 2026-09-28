# ADR-0001 — PWA local-first como primera interfaz

Status: **SUPERSEDED**  
Date: **2026-09-28**  
Sustituido por: **[ADR-0007](0007-native-iphone-first.md)** (2026-09-28)

> Este ADR se conserva por trazabilidad. La interfaz principal y el calendario de la app nativa los decide ahora ADR-0007. Los principios local-first y offline útil siguen vigentes; la PWA ya no es la interfaz principal y la app nativa ya no es «futura».

## Contexto

El iPhone es el dispositivo principal. La primera versión debe sentirse como una aplicación, funcionar con coste 0 € y evolucionar sin obligar a publicar en App Store. Una PWA no puede acceder directamente a todas las bases privadas de Apple y no ofrece ejecución continua fiable en segundo plano.

## Decisión

La primera interfaz será una PWA instalable y local-first. Captura, consulta y edición esencial funcionarán sin red. La sincronización se intentará al abrir, recuperar conectividad o volver a primer plano.

Las capacidades de Apple imposibles para la web entrarán por Atajos, importación explícita o un companion nativo futuro.

## Consecuencias

- El almacenamiento local y las migraciones son parte del núcleo del producto.
- No se promete sync inmediato con la PWA cerrada.
- La app nativa queda desacoplada de MANU BRAIN.
- Antes de aceptar datos personales reales debe existir exportación/restauración probada.

## Alternativas rechazadas

- App nativa desde el inicio: añade coste, distribución y complejidad antes de validar valor.
- Web dependiente de servidor: rompe el funcionamiento offline y aumenta exposición de datos.
