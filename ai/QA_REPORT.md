# QA REPORT

## Estado

**BRAIN-01 — revisión externa realizada; correcciones aplicadas; pendiente de aprobación de Manu.**

Revisor: Claude Code, sesión de revisión externa del PR #2 (no es el implementador de `caf146c`–`1941319`). Fecha: 2026-09-28.

## Alcance revisado

Head revisado: `1941319`. Contratos (`Sources/ManuBrainDomain/ManuBrainDomain.swift`), tests, `Package.swift`, workflows, ADR-0010, `BRAIN_01_TASK.md` y coherencia con ADR-0002, ADR-0008, `DATA_MODEL.md`, `ARCHITECTURE.md` y `THREAT_MODEL.md`.

## Evidencia

Entorno local: Swift 6.3.3 (`swift-6.3.3-RELEASE`, toolchain oficial de swift.org) en Linux x86_64. La CI del PR usa la misma versión en macOS 26 ARM64.

1. Head original `1941319`: `dump-package`, `build --build-tests` y `test --parallel` → **13/13 PASS** (reproduce la CI).
2. Sondeos ejecutables sobre `1941319` que demuestran 10 defectos (tabla siguiente). Uno de ellos aborta el proceso de tests.
3. Tras las correcciones: `dump-package` PASS, `build --build-tests` PASS sin warnings, `test --parallel` → **31/31 PASS en 3 suites**.
4. Los tests de regresión nuevos, ejecutados contra el código original, fallan o abortan el proceso.
5. CI del commit de correcciones `807e6a3` en GitHub Actions `macos-26`: job `contracts` (run `36451712052`) **31/31 PASS en 3 suites**; Foundation check (runs `36451704712` y `36451712092`) PASS.
6. Revisión del orquestador sobre `807e6a3`: detectó que `REJECTED` y `RETRACTED` seguían permitidos para modelos. La validación queda cerrada a `PROPOSED` y el test parametrizado cubre los cinco estados no permitidos. La evidencia de CI del commit posterior se registrará al finalizar GitHub Actions.

## Defectos demostrados y corregidos

| # | Defecto en `1941319` | Regla incumplida | Corrección | Test |
| --- | --- | --- | --- | --- |
| 1 | `validateClaimEvidence` aceptaba una Claim ACTIVE creada por un modelo si se pasaba otro agente como `creator` | «Una Claim creada por modelo entra como PROPOSED» | exige `creator.id == claim.createdByAgentID` (`creatorMismatch`) | `creatorMustMatchClaim` |
| 2 | un modelo podía crear cualquier estado distinto de `PROPOSED`, incluidos estados finales `REJECTED` y `RETRACTED` | ídem; ADR-0002 | un modelo solo puede crear `PROPOSED`; cualquier otro estado requiere confirmación o transición determinista auditada | `modelCannotCreateNonProposedClaims`, `modelCanPropose` |
| 3 | `supersedeClaim` en una fecha anterior a `validFrom` producía `validUntil < validFrom` | invariante `valid_until >= valid_from` | lanza `invalidValidityRange` | `supersedeBeforeValidFrom` |
| 4 | `supersedeClaim` sobrescribía un `validUntil` anterior y ampliaba la vigencia | DATA_MODEL: «se cierra su valid_until si no existía» | usa `min(validUntil, timestamp)` | `supersedeKeepsEarlierValidUntil` |
| 5 | se podía sustituir una Claim `REJECTED`, `PROPOSED`, `RETRACTED` o ya `SUPERSEDED`, que pasaba a ser visible | rechazos y propuestas no deben reaparecer | solo `ACTIVE` o `CONTESTED` (`claimNotSupersedable`) | `nonVisibleClaimsCannotBeSuperseded` |
| 6 | con dos Claims `CONTESTED`, `resolveCurrentClaims` devolvía una sola (la más reciente) | ARCHITECTURE: nunca resolver en silencio | si el grupo tiene alguna `CONTESTED`, devuelve todas las visibles | `contestedClaimsStayVisible` |
| 7 | `Source.hasOriginal` era `true` con retención `EXTRACTED_ONLY`, `REFERENCE_ONLY` o `TRANSIENT` si se marcaba `originalRetained` | ADR-0008 §5 | solo `FULL` puede tener original | `retentionPolicyBoundsOriginal` |
| 8 | `detectSupersessionCycle` abortaba el proceso (`Fatal error: Duplicate values for key`) con IDs repetidos | una función pura pública no debe abortar | grafo con lista de aristas y DFS | `cycleDetectionWithDuplicateIDs`, `longerCycle` |
| 9 | `SourceItem`, `Fragment`, `SourceDeletionEvent`, `Entity`, `Activity`, `Money`, `LocationValue` y `TypedJSON` no tenían `init` público: otro módulo (las futuras apps) no podía construirlos | ADR-0010: núcleo compartido por iPhone y Mac | `init` públicos | target nuevo `ManuBrainDomainPublicAPITests` sin `@testable` |
| 10 | `UTCTimestamp` aceptaba `…+01:00Z` (no UTC) y `2026-02-30T00:00:00Z` (normalizado a otra fecha); `==` usaba el texto y era incoherente con `<` | «timestamps ISO-8601 UTC» | patrón estricto, comprobación de componentes y igualdad por instante | `rejectsInvalidTimestamps`, `timestampEqualityFollowsInstant`, `decodingRejectsInvalidTimestamp` |

Cobertura añadida: validación de UUIDv7 (ningún test la cubría), estados ocultos en la resolución temporal y ciclos de más de dos elementos.

Además: `.gitignore` ignora `.build/` y `.swiftpm/`.

## Observaciones no bloqueantes (no corregidas)

- **Claim derivada sin Activity**: DATA_MODEL exige Activity para Claims derivadas; `activityID` es opcional y no se valida. Hace falta definir «derivada» antes de imponerlo.
- **Activación de Claims de modelo**: no hay operación para que Manu active una propuesta de modelo; `validateClaimEvidence` rechazará siempre una Claim de modelo ACTIVE. Diseñar un registro de aprobación en BRAIN-02.
- **Predicados multivalor**: `resolveCurrentClaims` devuelve una sola Claim por sujeto y predicado; sirve para predicados de un valor, no para listas (por ejemplo, gustos).
- **Sensibilidad**: las Claims no llevan etiqueta de sensibilidad; una Claim derivada de una fuente sensible podría acabar en una superficie bloqueada si BRAIN-02 no la hereda.
- **Retención**: no hay función que valide la coherencia Source ↔ `SourceDeletionEvent` («si el original no se conserva, existe un evento o la política lo explica»), ni que `result: COMPLETED` tenga `completedAt`.
- **StrictJSON**: solo comprueba claves de primer nivel y la lista de claves la pasa el llamador; los objetos anidados (`objectValue`, `metadata`) no se comprueban.
- **Money** usa `Double`; conviene `Decimal` antes de que existan datos persistidos.
- **Confianza**: solo se valida el rango 0–1 para INFERENCE/HYPOTHESIS; en otras clasificaciones no se valida. `ClaimValue.date` no valida el formato de fecha.
- **Workflow**: `concurrency.group` contiene `brain-01-\${{ github.ref }}`; la barra invertida queda literal en el nombre del grupo (inofensivo). `actions/checkout@v4` no está fijado por SHA.
- **Coste de CI**: los runners macOS de GitHub Actions en repositorios privados consumen minutos con multiplicador. Coste real `NO_VERIFICADO`: depende del límite de gasto de la cuenta.

## NO VERIFICADO

- Compilación para iOS, firma e instalación en dispositivos (la CI solo compila y prueba el paquete en macOS).
- Integración con almacenamiento, cifrado, sync o interfaz.

## Regla

La QA debe ejecutarse sobre evidencia reproducible y diferenciar probado, no probado, bloqueado por el entorno y fuera de alcance. El implementador no debe aprobar su propia QA final. La aprobación final y el merge corresponden a Manu.
