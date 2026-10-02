# Precios Super San Juan

Web simple para comparar precios de supermercados de San Juan, Argentina. Buscás un producto
(ej. "leche la serenísima") y la página consulta en paralelo las tiendas online de cada super,
agrupa el mismo producto por código de barras (EAN) y te muestra dónde conviene comprarlo.

## Supermercados incluidos

| Super      | Fuente                         | Precio                                        |
| ---------- | ------------------------------ | --------------------------------------------- |
| Carrefour  | carrefour.com.ar (VTEX)        | Sucursal San Juan (CP 5400)                   |
| ChangoMás  | masonline.com.ar (VTEX)        | Región San Juan (CP 5400)                     |
| La Anónima | laanonima.com.ar (HTML)        | Sucursal San Juan, ex Hiper Libertad (id 180) |
| Vea        | vea.com.ar (VTEX)              | Precio online nacional                        |
| Átomo      | atomoconviene.com (PrestaShop) | Precio de la tienda online                    |

No incluidos (no tienen tienda online con buscador o no están en San Juan):

- **Makro** y **Yaguar** (mayoristas): solo publican catálogos/folletos, sin buscador de precios.
- **Jumbo / Disco / Coto / Diarco**: no tienen sucursales en San Juan.

En La Anónima se muestra el precio que paga cualquier cliente; el "precio PLUS" (solo con la
tarjeta de La Anónima) no se usa.

## Cómo funciona

- `src/lib/scrapers.ts`: consulta la búsqueda de cada tienda. En las tiendas VTEX se usa la
  API `intelligent-search` con la región del código postal 5400 para obtener precios de San Juan.
- `src/lib/search.ts`: junta los resultados, agrupa por código de barras y calcula el ahorro.
- `src/app/api/buscar/route.ts`: endpoint `GET /api/buscar?q=...`. Las respuestas se cachean
  30 minutos en la CDN de Vercel para no saturar a los supermercados.
- `src/components/PriceSearch.tsx`: buscador, comparación directa, filtros por super y orden
  por precio o por precio por kg/litro.

No hay base de datos: los precios se consultan en vivo en cada búsqueda (con caché).

## Desarrollo local

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abrir http://localhost:3000.

## Deploy en Vercel

1. Entrar a https://vercel.com/new e importar este repositorio.
2. Framework: Next.js (se detecta solo). No hace falta configurar variables de entorno.
3. Deploy.

## Limitaciones

- Los precios son los de las tiendas online; en la góndola pueden variar.
- Si un supermercado cambia su sitio o bloquea las IPs de Vercel, ese super aparece como
  "no respondió" y el resto sigue funcionando.
- La comparación directa solo agrupa productos con el mismo código de barras.
