# MANU OS

MANU OS será una capa visual y operativa sobre el iPhone: una app nativa que adapta el teléfono a los momentos del día (mañana, trabajo, fuera del trabajo, fin de semana) mediante la app, widgets, pantalla bloqueada, Centro de Control, botón de acción, Live Activities y Atajos. Por debajo, MANU BRAIN es una infraestructura personal local-first para capturar, relacionar y recuperar información con procedencia, historia y privacidad, independiente de la interfaz y de cualquier proveedor de IA.

## Estado

- BRAIN-00: documentación y arquitectura completadas; revisadas por [ADR-0007](docs/adr/0007-native-iphone-first.md) (experiencia nativa de iPhone como prioridad).
- BRAIN-01: preparado, pero no autorizado.
- Decisiones pendientes: D-01 a D-06 (ver [decisiones y puntos abiertos](docs/architecture/DECISIONS_AND_OPEN_ITEMS.md)).
- Producto: aún no implementado.

No conectes servicios, claves ni datos personales reales en esta fase.

## Lectura inicial

1. `AGENTS.md`
2. `docs/product/PRODUCT_CHARTER.md`
3. `docs/architecture/ARCHITECTURE.md`
4. `docs/architecture/DATA_MODEL.md`
5. `docs/security/THREAT_MODEL.md`
6. `ai/PROJECT_STATE.md`
7. `ai/CURRENT_TASK.md`

También están disponibles el [contrato verificable del MVP](docs/product/MVP_ACCEPTANCE.md), el [backlog técnico](docs/roadmap/BACKLOG.md), el [registro de riesgos](docs/security/RISK_REGISTER.md) y los [ADRs](docs/adr/README.md).

## Flujo

Todo cambio sustancial se realiza en una rama, se verifica y se revisa mediante PR antes de llegar a la rama por defecto. Claude Code tiene acceso a este repositorio desde el 2026-09-28 para tareas documentales que Manu autoriza de forma explícita. No está autorizado a implementar producto ni a iniciar BRAIN-01.
