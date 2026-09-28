# MVP — Acceptance Contract

El MVP no se declara terminado por número de pantallas. Debe completar un ciclo de información seguro, offline y recuperable.

## Recorrido obligatorio

1. Instalar la PWA en un iPhone y un Mac compatibles.
2. Capturar texto y enlace sin red.
3. Importar un archivo o foto elegidos explícitamente.
4. Cerrar y reabrir la app sin perder las capturas.
5. Conservar fuente, fecha, autor/origen y hash.
6. Convertir una captura en entidad/Claim con evidencia visible.
7. Buscar por texto, tipo, fecha, persona o proyecto.
8. Explicar una conexión mediante la cadena de evidencia.
9. Sustituir una decisión antigua y consultar ambos estados históricos.
10. Exportar el vault.
11. Restaurarlo en un perfil limpio y obtener los mismos recuentos/hashes.
12. Seguir utilizando el núcleo con IA e integraciones desconectadas.

## Umbrales

- Captura de texto desde Home Screen: objetivo inferior a 10 segundos.
- Claims derivadas con evidencia o marcadas claramente como hipótesis: 100 %.
- Pérdida de capturas confirmadas en pruebas offline/reinicio: 0.
- Diferencias de hash tras export/restore: 0.
- Peticiones de red inesperadas en modo local: 0.
- Errores críticos de accesibilidad en el recorrido principal: 0.

## Evidencia requerida

- test automatizado para invariantes de dominio;
- test de persistencia con cierre/reapertura;
- prueba manual real en iPhone y Mac;
- manifiesto y resultado de export/restore;
- informe de red en modo local;
- QA independiente del handoff del implementador.

## No cuenta como MVP

- mockups o demo sin persistencia;
- grafo visual sin procedencia;
- chat que responde sin mostrar fuentes;
- integración teórica no probada;
- backup que nunca se ha restaurado;
- experiencia que deja de funcionar al acabar una cuota de IA.
