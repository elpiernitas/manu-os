# ADR-0003 — Cifrado del contenido antes de sincronizar

Status: **ACCEPTED**  
Date: **2026-09-28**

## Contexto

El corpus contendrá conversaciones, relaciones, calendario, documentos y posibles datos sensibles. El proveedor remoto no debe convertirse en una copia legible de la vida de Manu.

## Decisión

El contenido destinado a sincronización se cifra en el cliente. La nube almacena ciphertext y metadatos mínimos. La autenticación del servicio y el cifrado del vault son mecanismos separados.

La implementación concreta de claves y recuperación no empieza hasta tener un threat model actualizado y tests criptográficos. BRAIN-00 define la dirección; no declara el cifrado como implementado.

## Consecuencias

- Búsqueda e inferencia principal ocurren con el vault abierto en el cliente.
- Perder el secreto de recuperación puede hacer los datos irrecuperables; la UX de recuperación es crítica.
- Push notifications no incluyen contenido sensible.
- Un proveedor cloud comprometido no debería poder leer el corpus.

## Alternativas rechazadas

- Cifrado solo del proveedor: el servidor seguiría viendo el contenido.
- Guardar claves junto a los datos: elimina la frontera de seguridad buscada.
