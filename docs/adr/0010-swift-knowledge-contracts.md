# ADR-0010 — Contratos de conocimiento en Swift

- Status: ACCEPTED
- Date: 2026-09-28

## Contexto

D-01 decide un único núcleo Swift compartido por las futuras apps SwiftUI de iPhone y Mac. BRAIN-01 necesita contratos ejecutables y verificables sin depender de interfaz, almacenamiento, red ni proveedores de IA.

## Decisión

- Implementar MANU BRAIN como Swift Package.
- Usar structs inmutables y Codable, con funciones puras para validación, sustitución y resolución temporal.
- No añadir dependencias externas en BRAIN-01.
- Validar UUIDv7, timestamps UTC, evidencia, confianza y ciclos en el límite del dominio.
- Rechazar campos superiores desconocidos mediante StrictJSON al decodificar datos externos.
- Verificar el paquete en GitHub Actions macos-26; el runner local de Manu no es requisito.

## Consecuencias

- El dominio se puede compilar sin proyecto Xcode y compartir después con iPhone y Mac.
- El almacenamiento y las extensiones quedan detrás de límites futuros; no forman parte de este ADR.
- Codable por sí solo tolera campos desconocidos. Toda entrada externa que afecte a integridad debe entrar por StrictJSON, no por JSONDecoder directamente.
- La verificación en CI no demuestra que la futura app funcione en el iPhone de Manu.
