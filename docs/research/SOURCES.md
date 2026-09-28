# Fuentes técnicas consultadas

Fecha de consulta: 2026-09-28. Las capacidades que dependan de cuenta/dispositivo siguen marcadas como NO VERIFICADO hasta prueba real.

## Apple y web

- [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)
- [Safari 17 storage quota changes](https://webkit.org/blog/14205/news-from-wwdc23-webkit-features-in-safari-17-beta/)
- [Origin Private File System in WebKit](https://webkit.org/blog/12257/the-file-system-access-api-with-origin-private-file-system/)
- [WebKit bug: Web Share Target API support](https://bugs.webkit.org/show_bug.cgi?id=194593)
- [Apple EventKit](https://developer.apple.com/documentation/eventkit)
- [Apple personal data technologies](https://developer.apple.com/documentation/technologyoverviews/personal-data)
- [Apple Share extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html)
- [Apple Developer account overview](https://developer.apple.com/help/account/basics/about-your-developer-account)
- [Apple Shortcuts input types](https://support.apple.com/guide/shortcuts/input-types-apd7644168e1/ios)
- [Apple Shortcuts clipboard](https://support.apple.com/guide/shortcuts/apd081d9d61f/ios)

## App nativa de iPhone (añadidas por ADR-0007)

Consultadas el 2026-09-28. Se comprobó que las páginas de documentación existen, no que cada capacidad funcione en el iPhone o con la cuenta de Manu.

- [WidgetKit](https://developer.apple.com/documentation/widgetkit)
- [App Intents](https://developer.apple.com/documentation/appintents)
- [ActivityKit (Live Activities)](https://developer.apple.com/documentation/activitykit)
- [Human Interface Guidelines — Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy) (consultada a través de la copia de referencia de la skill `apple-design`)
- [Human Interface Guidelines — Managing notifications](https://developer.apple.com/design/human-interface-guidelines/managing-notifications) (Focus e interrupción; consultada a través de la misma copia)

Sin fuente verificada en esta revisión: controles del Centro de Control, filtros de Focus para apps, API de alarmas para terceros, grabación de llamadas en iOS y capacidades disponibles con cuenta gratuita frente a Apple Developer Program. Deben documentarse con fuente antes de cerrar D-03 y las fases que las usen. *(Parcialmente cubierto en la sección siguiente.)*

## Almacenamiento local, claves y contenedor compartido (D-02, añadidas por ADR-0011)

Consultadas el 2026-09-28. Las páginas de referencia de Apple Developer en este entorno se sirven con contenido dependiente de JavaScript que la herramienta de lectura automática no puede extraer; cuando no fue posible confirmar el contenido exacto de una página oficial, se marca `NO_VERIFICADO` y se apoya en resultados de búsqueda que citan esa misma página o en foros oficiales de Apple Developer.

- [Data Protection classes (Apple Platform Security)](https://support.apple.com/guide/security/data-protection-classes-secb010e978a/web): describe las cuatro clases de protección de archivos; **no se pudo leer el contenido completo en esta revisión** porque `support.apple.com` no es accesible desde este entorno (egress bloqueado). Resumen tomado de fuentes secundarias que citan esa guía: `NSFileProtectionComplete` cifra con una clave que se retira de memoria al bloquear el dispositivo; `NSFileProtectionCompleteUntilFirstUserAuthentication` es el valor por defecto de iOS 7+ y permite acceso tras el primer desbloqueo, incluido en segundo plano.
- [NSFileProtectionType — Complete (Apple Developer)](https://developer.apple.com/documentation/foundation/fileprotectiontype/complete): existencia de la página confirmada; contenido exacto `NO_VERIFICADO` en esta revisión por la misma limitación de lectura.
- [Configuring app groups (Apple Developer)](https://developer.apple.com/documentation/xcode/accessing-app-group-containers) y [Accessing app group containers (Apple Developer)](https://developer.apple.com/documentation/xcode/accessing-app-group-containers): existencia confirmada; mecanismo general (contenedor de archivos, `UserDefaults` compartido, grupo de acceso de Keychain) confirmado por múltiples fuentes secundarias coincidentes. Si la entitlement de App Groups funciona de forma estable con una cuenta gratuita (Personal Team) **no tiene fuente primaria concluyente verificada** en esta revisión: hilos del foro oficial de Apple Developer (`developer.apple.com/forums`) describen tanto configuraciones que funcionan como fallos de registro de App ID con cuentas personales. Se mantiene como `NO_VERIFICADO`, igual que ya constaba en la sección anterior de este documento.
- [Keychain services (Apple Developer)](https://developer.apple.com/documentation/security/keychain-services) y las páginas individuales de `kSecAttrAccessible*`: existencia confirmada; comportamiento de cada valor (`WhenUnlocked`, `AfterFirstUnlock`, `Always`, con y sin `ThisDeviceOnly`) tomado de fuentes secundarias coincidentes con el propio nombre de cada símbolo. Estado exacto de deprecación de `kSecAttrAccessibleAlways`/`AlwaysThisDeviceOnly` `NO_VERIFICADO`; se evitan por buena práctica al ser accesibles antes del primer desbloqueo.
- [App Groups Entitlement — com.apple.security.application-groups (Apple Developer)](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.application-groups): existencia confirmada; contenido exacto `NO_VERIFICADO`.
- [CryptoKit (Apple Developer)](https://developer.apple.com/documentation/cryptokit) y [HKDF (Apple Developer)](https://developer.apple.com/documentation/cryptokit/hkdf): confirman AES-GCM, SHA-2 y HKDF nativos.
- [Add Argon2id key derivation function — apple/swift-crypto#427 (GitHub)](https://github.com/apple/swift-crypto/pull/427): pull request abierta, no fusionada en esta revisión; confirma que Argon2id no es nativo de CryptoKit/swift-crypto todavía.
- [GRDB.swift (GitHub)](https://github.com/groue/GRDB.swift): motor de acceso a SQLite en Swift, alternativa documentada si el wrapper propio sobre `sqlite3` resulta demasiado costoso de mantener.

Limitación general de esta sección: `support.apple.com` está bloqueado por el proxy de red de este entorno y las páginas de `developer.apple.com` se sirven con contenido dinámico que la herramienta de lectura automática de este entorno no logra extraer de forma fiable. Antes de dar por cerrada cualquier capacidad de esta lista debe confirmarse leyendo la página oficial desde un entorno con acceso completo, o probándola en Xcode con el Apple ID de Manu.

## Correcciones tras revisión externa del PR #5 (2026-09-28)

- [GitHub Actions `macos-26` runner image README](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md): confirma que el runner incluye siete versiones de Xcode (26.0.1 a 26.6, la 26.6 por defecto), SDKs de iOS 26.0 a 26.5 con sus SDKs de simulador correspondientes, e imágenes de iOS Simulator instaladas (iPhone 17 Pro, iPhone 17 Pro Max y varios iPad). Leída con éxito por ser Markdown plano en `raw.githubusercontent.com`, no una página de `developer.apple.com`.
- [Apple Technical Note TN2339 — Building from the Command Line with Xcode FAQ](https://developer.apple.com/library/archive/technotes/tn2339/_index.html): documenta que `xcodebuild` compila y ejecuta tests de un proyecto o workspace eligiendo un destino (`-destination`), incluido un destino de iOS Simulator. Existencia y tema confirmados; contenido exacto `NO_VERIFICADO` por la misma limitación de lectura de páginas de Apple ya señalada.
- Resultados de búsqueda coincidentes (foros oficiales de Apple Developer y varias guías de CI de terceros) confirman que fijar `CODE_SIGNING_ALLOWED=NO` (junto a `CODE_SIGNING_REQUIRED=NO` y `CODE_SIGN_IDENTITY=""`) permite compilar y ejecutar tests contra un destino de iOS Simulator sin firma, sin perfil de aprovisionamiento y sin Apple ID. Los mismos foros oficiales indican que el simulador **no aplica** la autorización de entitlements por perfil de aprovisionamiento que sí exige un dispositivo físico, por lo que un build de simulador puede declarar App Groups u otras capacidades sin registrarlas contra un equipo de desarrollador.
- [Andy Ibanez — "When CryptoKit is not Enough"](https://www.andyibanez.com/posts/cryptokit-not-enough/) y la fuente de Apple [`CommonCrypto`/`CommonKeyDerivation.c`](https://github.com/Apple-FOSS-Mirror/CommonCrypto/blob/master/Source/API/CommonKeyDerivation.c): confirman que CryptoKit no expone PBKDF2 y que `CCKeyDerivationPBKDF` de CommonCrypto es la implementación de Apple para esa función. Corrige una atribución incorrecta de una versión anterior de `docs/adr/0011-native-local-storage-and-keys.md`, que mencionaba "CryptoKit/CommonCrypto" de forma intercambiable para PBKDF2.

Ninguna de estas correcciones se ha ejecutado todavía en un job de CI de este repositorio: quedan como razonamiento apoyado en fuentes secundarias y primarias de GitHub, pendientes de la primera verificación reproducible (ver criterio de aceptación en `docs/roadmap/BRAIN_02_TASK.md`).

## Dispositivos, herramientas y servicios (decisiones de producto, 2026-09-28)

Consultadas el 2026-09-28. Resumen de lo que dice cada fuente; no implica prueba en los dispositivos de Manu.

- [How to get Apple Intelligence (Apple Support)](https://support.apple.com/en-us/121115): requiere iPhone 15 Pro, 15 Pro Max o serie 16 y posteriores, y Mac con M1 o posterior. El iPhone 14 y los Mac Intel no son compatibles.
- [Models with an Action button (Apple Support)](https://support.apple.com/guide/iphone/aside/iph44c8b4227/18.0/ios/18.0): iPhone 15 Pro, 15 Pro Max, 16, 16 Plus, 16 Pro, 16 Pro Max y 16e (lista de la guía de iOS 18).
- [iPhone models compatible with iOS 26 (Apple Support)](https://support.apple.com/en-me/guide/iphone/iphe3fa5df43/ios): incluye el iPhone 14.
- [Xcode system requirements (Apple Developer)](https://developer.apple.com/xcode/system-requirements/): Xcode 26.4.1 a 26.6 requieren macOS Tahoe 26.2 o posterior; Xcode 27 requiere macOS Tahoe 26.6 o posterior.
- [Identify your MacBook Pro model (Apple Support)](https://support.apple.com/en-gb/108052): `MacBookPro14,2` (13 pulgadas, 2017, cuatro puertos) tiene macOS Ventura como última versión oficialmente compatible.
- [GitHub-hosted runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners): runners estándar disponibles para repositorios públicos y privados; el uso en privados consume minutos del plan.
- [GitHub macOS 26 runner image](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md): imagen ARM64 con Xcode 26.6 como versión por defecto en la consulta del 2026-09-28.
- [Xcode 27 public preview in GitHub Actions](https://github.com/actions/runner-images/issues/14404): Xcode 27 disponible en vista previa; la etiqueta anunciada es `xcode-27-xlarge`.
- [GitHub Actions billing and usage](https://docs.github.com/en/actions/concepts/billing-and-usage): los repositorios privados tienen minutos incluidos y el exceso puede facturarse; MANU OS mantendrá presupuesto de gasto 0 €.
- [macOS Tahoe 26 compatible computers (Apple Support)](https://support.apple.com/en-us/122867): los únicos portátiles Intel listados son MacBook Pro de 16 pulgadas (2019) y MacBook Pro de 13 pulgadas (2020, cuatro puertos Thunderbolt 3).
- [Developer account comparison (Apple Developer)](https://developer.apple.com/support/compare-memberships/): la cuenta gratuita permite probar en el dispositivo con Xcode; hasta 10 App IDs y 3 dispositivos que caducan a los 7 días, y perfiles que caducan a los 7 días. TestFlight, App Store Connect y notarización de Mac requieren el programa de pago.
- [Get Started with WeatherKit (Apple Developer)](https://developer.apple.com/weatherkit/): 500.000 llamadas al mes por membresía de Apple Developer Program.
- [AlarmKit (Apple Developer)](https://developer.apple.com/documentation/AlarmKit): framework de alarmas para apps en iOS y iPadOS 26.
- [Creating controls to perform actions across the system (Apple Developer)](https://developer.apple.com/documentation/widgetkit/creating-controls-to-perform-actions-across-the-system): controles de WidgetKit para Centro de Control, pantalla bloqueada y botón de acción (introducidos en iOS 18).
- [PHAssetChangeRequest.deleteAssets (Apple Developer)](https://developer.apple.com/documentation/photokit/phassetchangerequest/1624062-deleteassets): borrado de elementos de la fototeca; el sistema pide confirmación (según la documentación y los foros de Apple; hay informes de fallos en algunos casos).
- [Event triggers in Shortcuts (Apple Support)](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios): disparador de alarma «Is Stopped».
- [Transaction triggers in Shortcuts (Apple Support)](https://support.apple.com/guide/shortcuts/transaction-trigger-apd65c67538a/ios): disparador «When I tap» para tarjetas de Wallet; no documenta qué datos entrega.
- [Spotify Web API — Start/Resume Playback](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback): solo Spotify Premium; permiso `user-modify-playback-state`; admite `device_id`; no menciona DJ.
- [Línea 024 — Ministerio de Sanidad](https://www.sanidad.gob.es/linea024/home.htm): línea de atención a la conducta suicida, 24 horas, gratuita y confidencial.

Sin fuente verificada en esta revisión: batería de AirPods para apps de terceros, Toque posterior como disparador de Atajos, control del Chromecast desde Spotify Connect, APIs de Instagram, TikTok, ManyChat y Canva, calidad del OCR y del reconocimiento de voz en español, disponibilidad de HealthKit y App Groups con cuenta gratuita, y rendimiento de un modelo local en el Mac Intel.

## Google

- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [OAuth web-server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google OAuth best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [Google OAuth app state and testing limits](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
- [Google Drive appDataFolder](https://developers.google.com/workspace/drive/api/guides/appdata)
- [Google Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Calendar scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)

## Infraestructura y estándares

- [Cloudflare Workers pricing and free limits](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1 pricing behavior](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [W3C PROV data model](https://www.w3.org/TR/prov-dm/)
- [W3C PROV ontology](https://www.w3.org/TR/prov-o/)
- [PostgreSQL full text search](https://www.postgresql.org/docs/current/textsearch.html)
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
- [MCP security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)

## Agentes e importación

- [OpenAI MCP servers](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)
- [OpenAI Agents MCP connections](https://developers.openai.com/api/docs/guides/agents-api/tools/mcp)
- [Exportar historial y datos de ChatGPT](https://help.openai.com/es-es/articles/7260999-exporting-your-chatgpt-history-and-data)
- [Export Claude data](https://support.anthropic.com/en/articles/9450526-how-can-i-export-my-claude-ai-data)
