# MANU OS

MANU OS será una capa personal sobre el iPhone y el Mac de Manu. Su experiencia empieza en la pantalla bloqueada, los widgets, el Centro de Control, los modos y las automatizaciones; la app principal es la cabeza del sistema: memoria, organización, consulta, configuración y chat personal (MANU). Convierte capturas, enlaces, audios, calendario, gastos, salud, archivos e ideas en memoria organizada y siguientes pasos útiles.

Por debajo, MANU BRAIN es un núcleo local-first con procedencia, historia y privacidad, independiente de la interfaz y de cualquier proveedor de IA, que funciona sin IA.

## Estado

- BRAIN-00: documentación y arquitectura completadas; revisadas por [ADR-0007](docs/adr/0007-native-iphone-first.md), [ADR-0008](docs/adr/0008-source-retention-and-controlled-deletion.md), [ADR-0009](docs/adr/0009-manu-assistant-without-mandatory-ai.md) y las decisiones de producto de Manu ([experiencia](docs/product/EXPERIENCE.md)).
- BRAIN-01: preparado, pero no autorizado.
- Decisiones pendientes: D-01 a D-09 (ver [decisiones y puntos abiertos](docs/architecture/DECISIONS_AND_OPEN_ITEMS.md)). Para D-04 faltan datos del Mac de Manu.
- Entrega prevista: un MVP técnico interno y después una primera Beta integrada para Manu ([contrato](docs/product/MVP_ACCEPTANCE.md)).
- Producto: aún no implementado.

No conectes servicios, claves ni datos personales reales en esta fase.

## Lectura inicial

1. `AGENTS.md`
2. `docs/product/PRODUCT_CHARTER.md`
3. `docs/product/EXPERIENCE.md`
4. `docs/architecture/ARCHITECTURE.md`
5. `docs/architecture/DATA_MODEL.md`
6. `docs/security/THREAT_MODEL.md`
7. `ai/PROJECT_STATE.md`
8. `ai/CURRENT_TASK.md`

También están disponibles el [contrato del MVP técnico y la Beta 1](docs/product/MVP_ACCEPTANCE.md), el [backlog técnico](docs/roadmap/BACKLOG.md), el [registro de riesgos](docs/security/RISK_REGISTER.md) y los [ADRs](docs/adr/README.md).

## Flujo

Todo cambio sustancial se realiza en una rama, se verifica y se revisa mediante PR antes de llegar a la rama por defecto. Claude Code tiene acceso a este repositorio desde el 2026-09-28 para tareas documentales que Manu autoriza de forma explícita. No está autorizado a implementar producto ni a iniciar BRAIN-01 o BRAIN-02.
