# AutoLog solo en el móvil (sin servidor)

[English](../en/phone-only.md) · **Español**

> **Para quién:** cualquiera. Es la forma más fácil: sin cuenta, sin registrarte y sin montar ningún servidor.
> **Nivel:** 🟢 ninguno. **Tiempo:** 1 minuto. **Qué necesitas:** un móvil con Chrome (Android) o Safari (iPhone).
> **Límite:** los datos están solo en ese móvil (ver [qué no hace](#qué-hace-y-qué-no)). Para varios móviles o tu familia,
> mira [un clic](one-click.md) o [tu propio servidor](self-hosting.md).

## Empieza en 3 pasos

1. **Abre [davidniin.github.io/autolog/app](https://davidniin.github.io/autolog/app/) en el móvil.**
2. **Añádela a la pantalla de inicio:**
   - **Android (Chrome):** menú **⋮ → Instalar aplicación** (o *Añadir a pantalla de inicio*).
   - **iPhone (Safari):** botón **Compartir ⬆︎ → Añadir a pantalla de inicio**.
3. **Ábrela desde el icono nuevo**, crea tu vehículo y apunta tu primer repostaje. Funciona sin cobertura.

Tus datos se guardan en el propio móvil y no se envían a ningún sitio.

## Qué hace y qué no

| | Solo móvil | Servidor propio |
|---|---|---|
| Repostajes, gastos, avisos, neumáticos y piezas, costes | ✅ | ✅ |
| Escáner de facturas (lee la foto en el móvil) | ✅ | ✅ |
| Informe del historial (PDF) y exportar CSV/JSON | ✅ | ✅ |
| Funciona sin cobertura | ✅ | ✅ |
| Varios móviles con los mismos datos | ❌ | ✅ |
| Varias personas, cada una con su clave | ❌ | ✅ |
| Avisos push y calendario de avisos | ❌ | ✅ |
| Fotos y PDF adjuntos a los gastos | ❌ (el escáner sí las lee) | ✅ |

**¿Por qué no?** Compartir entre móviles o personas y los avisos push necesitan un servidor que los reparta, así que no
son posibles solo en el móvil. Las fotos adjuntas sí se podrían guardar en el propio móvil: está en la hoja de ruta.

## Cuida tus datos

Todo vive **solo en ese móvil**. Si borras los datos del navegador, desinstalas la app o cambias de móvil sin copia, se pierde. Por eso:

1. En **⚙ Ajustes → Tus datos**, pulsa **Copia sin fotos (JSON)** de vez en cuando. AutoLog te lo recuerda pasado un mes sin copia.
2. Guarda el archivo en un sitio seguro (tu nube, tu correo…).
3. En un móvil nuevo: abre AutoLog, elige **Tengo una copia** y selecciona el archivo.

En iPhone usa la app desde el **icono de la pantalla de inicio** (no desde una pestaña de Safari): Safari puede borrar los datos de
las webs que no abres en unas semanas, pero no los de las apps añadidas a la pantalla de inicio.

## Pasar después a tu propio servidor

Exporta una copia en ⚙ Ajustes, monta tu servidor ([un clic](one-click.md) o [autoalojada](self-hosting.md)), ábrelo e importa el
mismo archivo (*Tengo una copia*). Las fotos nunca se guardaron, así que no se pierde nada.

## Para desarrolladores

La app solo móvil es el mismo código que la del servidor, compilada con `npm run build:app` (`--mode phone`): sin sincronización,
sin clave y sin adjuntos. Se publica en `/app/` con `.github/workflows/pages.yml`. Los datos están en el `localStorage` (claves
`autolog.*`) del origen del sitio; si lo alojas en un dominio compartido con otras webs, cualquiera de ellas puede leerlos, así
que conviene un dominio propio.
