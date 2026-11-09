# Cifrado de extremo a extremo para Tu nube — investigación WEB-99

Estado: **PROPUESTA, no implementada.** Hoy Tu nube **no** es de extremo a extremo (ADR-0017): la protegen la RLS, TLS y el cifrado en reposo del proveedor, y Supabase podría leerla.

## 1. Qué se quiere

Que en Supabase solo haya datos ilegibles para cualquiera que no sea el iPhone o el Mac de Manu, incluida la propia Supabase y quien entre en el panel, sin volver al problema de WEB-64.

## 2. Por qué falló WEB-64 (frase de paso)

La clave salía de una frase que Manu escribía en cada dispositivo. Un carácter distinto entre el iPhone y el Mac producía otra clave, y los datos no se podían abrir. Manu eligió quitar la frase (ADR-0017, enmienda WEB-67).

## 3. Propuesta: una clave de dispositivo, sin frase

| Pieza | Cómo |
|---|---|
| **Clave** | AES-256-GCM generada por WebCrypto en el primer dispositivo. Nunca sale hacia Supabase. |
| **Pasar la clave al otro dispositivo sin cable** | En el Mac, «Copiar clave»; en el iPhone, «Pegar clave», con el **Portapapeles universal** de Apple (mismo Apple ID, Bluetooth y wifi). Alternativa: un QR que el iPhone lee con la cámara y que contiene un texto para pegar. No se usa un enlace, porque iOS abre los enlaces en Safari y no en el icono, y Safari guarda sus datos aparte. Como alternativa, un `#fragmento`, que nunca llega a ningún servidor. |
| **Qué se cifra** | Todo `manu_sync.data`: `{ v: 2, iv, ct }`. Supabase solo ve el tamaño, las fechas, `rev` y el nombre del dispositivo. |
| **Comprobación** | Un `kid` (huella corta de la clave) en el sobre. Un dispositivo con otra clave lo detecta y lo dice («esta clave no es la de tu nube») en vez de sobrescribir. |
| **Recuperación** | Si se pierden los dos dispositivos, sin copia de la clave **no hay recuperación posible**. Opciones para que decida Manu: guardarla en la app Contraseñas o Llavero de iCloud como contraseña de «MANU OS»; imprimir un código, o aceptar el riesgo. |

## 4. Cómo encaja con lo que ya hay

- **Sincronización selectiva y lápidas (WEB-99):** se aplican antes de cifrar al subir y después de descifrar al bajar. No cambian.
- **Avisos push:** la cola sigue siendo sin texto por defecto. Con «Mostrar el texto», ese texto lo lee el servidor; es inevitable, porque es él quien envía el aviso.
- **Buzón del atajo «MANU Dinero»:** el atajo no puede cifrar con facilidad, así que sus líneas siguen en claro hasta que MANU las recoge y las borra.
- **CSP:** sin cambios. Todo con WebCrypto, sin librerías.

## 5. Riesgos

- La clave vive en el almacenamiento del dispositivo. Cualquier código que corriera en el origen de MANU (XSS) podría leerla, igual que hoy puede leer el vault. La CSP estricta lo mitiga.
- Un error al pasar la clave deja un dispositivo sin poder leer. Se detecta por el `kid` y no se sobrescribe nada.
- Coste: 0 €. Esfuerzo: medio (WEB-100).

## 6. Qué necesita Manu decidir

1. Hacer WEB-100 (sí/no).
2. Método de recuperación: Llavero de iCloud, código impreso o ninguno.
