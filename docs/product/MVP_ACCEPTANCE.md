# MVP — Acceptance Contract

> Revisado el 2026-09-28 por [ADR-0007](../adr/0007-native-iphone-first.md). La versión BRAIN-00 exigía instalar una PWA en iPhone y Mac; ahora el recorrido se centra en la app nativa de iPhone. Los pasos que dependen de decisiones abiertas lo indican.

El MVP no se declara terminado por número de pantallas. Debe completar un ciclo de información seguro, offline y recuperable, y demostrar que el iPhone se adapta al momento del día.

## Recorrido obligatorio

1. Instalar la app nativa de MANU OS en el iPhone de Manu. Si D-01 mantiene un componente web o una app para Mac, instalarlo también en un Mac compatible.
2. Capturar texto y enlace sin red desde la app.
3. Capturar texto o audio desde al menos una superficie del sistema (widget, App Intent/Atajo o botón de acción) sin abrir primero la app.
4. Importar un archivo o foto elegidos explícitamente.
5. Cerrar y reabrir la app, y reiniciar el iPhone, sin perder las capturas.
6. Conservar fuente, fecha, autor/origen y hash.
7. Convertir una captura en entidad/Claim con evidencia visible.
8. Buscar por texto, tipo, fecha, persona o proyecto.
9. Explicar una conexión mediante la cadena de evidencia.
10. Sustituir una decisión antigua y consultar ambos estados históricos.
11. Cambiar entre al menos dos modos (por ejemplo, Trabajo y Fuera del trabajo) y comprobar que cambian la app y al menos un widget.
12. Retirar un permiso (por ejemplo, calendario o micrófono) y comprobar que la app sigue funcionando y lo explica.
13. Exportar el vault.
14. Restaurarlo en una instalación limpia y obtener los mismos recuentos/hashes.
15. Seguir utilizando el núcleo con IA e integraciones desconectadas.

## Umbrales

- Captura de texto desde widget, botón de acción o pantalla de inicio: objetivo inferior a 10 segundos.
- Claims derivadas con evidencia o marcadas claramente como hipótesis: 100 %.
- Pérdida de capturas confirmadas en pruebas offline/reinicio: 0.
- Diferencias de hash tras export/restore: 0.
- Peticiones de red inesperadas en modo local: 0.
- Contenido marcado como sensible visible con el iPhone bloqueado (widgets, Live Activities, notificaciones): 0.
- Errores críticos de accesibilidad en el recorrido principal (Dynamic Type, VoiceOver, contraste): 0.

## Evidencia requerida

- test automatizado para invariantes de dominio;
- test de persistencia con cierre/reapertura;
- prueba manual real en el iPhone de Manu (y en Mac si D-01 lo incluye), indicando versión de iOS y tipo de aprovisionamiento;
- capturas de las superficies del sistema en cada modo probado;
- manifiesto y resultado de export/restore;
- informe de red en modo local;
- registro de permisos solicitados, en qué momento y con qué texto;
- QA independiente del handoff del implementador.

## No cuenta como MVP

- mockups o demo sin persistencia;
- grafo visual sin procedencia;
- chat que responde sin mostrar fuentes;
- integración teórica no probada;
- backup que nunca se ha restaurado;
- experiencia que deja de funcionar al acabar una cuota de IA;
- widgets o modos que solo funcionan en el simulador;
- una app que caduca sin que Manu sepa cómo reinstalarla (ver D-03).

## Fuera del MVP

Finanzas, grabación de llamadas y transcripciones quedan fuera del MVP. Tienen gates propios (G-07 y G-08 en `docs/roadmap/BACKLOG.md`).
