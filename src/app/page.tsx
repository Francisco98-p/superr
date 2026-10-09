import Link from "next/link";
import PriceSearch from "@/components/PriceSearch";
import VisitorCounter from "@/components/VisitorCounter";
import { getCachedOffers } from "@/lib/offers";
import { STORE_IDS, STORES } from "@/lib/stores";

const AUTHOR = { name: "Francisco Tejada", email: "franciscoemi98@gmail.com" };

export const maxDuration = 60;

export default async function Home({ searchParams }: PageProps<"/">) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";
  // Not awaited: the page streams right away and the offers fill in when ready.
  const offers = getCachedOffers();

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-emerald-700 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-4 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <Link href="/">Precios Super San Juan</Link>
            </h1>
            <p className="mt-1 text-sm text-emerald-50 sm:text-base">
              Buscá un producto y compará al instante los precios de los supermercados de San Juan.
            </p>
          </div>
          <VisitorCounter />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <PriceSearch key={initialQuery} initialQuery={initialQuery} offers={offers} />
      </main>

      <section className="mx-auto w-full max-w-6xl px-4 pb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div id="como-funciona" className="rounded-xl border border-dashed border-black/15 bg-white/60 p-5 text-sm text-neutral-600">
            <h2 className="font-medium text-neutral-800">Cómo obtenemos los precios</h2>
            <p className="mt-1">
              Cuando buscás, el sitio consulta al mismo tiempo las tiendas online de{" "}
              {STORE_IDS.map((id) => STORES[id].name).join(", ")}. Son los mismos datos públicos que ves al entrar
              a cada tienda: no hay acuerdos ni datos pagos. Carrefour, ChangoMás y La Anónima se consultan con la
              sucursal de San Juan; Vea y Átomo, con su precio online.
            </p>
            <p className="mt-2">
              Solo comparamos un producto cuando tiene el mismo código de barras y además coinciden el gramaje, el
              volumen y la cantidad. Cada resultado se guarda hasta una hora para no saturar a los supermercados, y
              cada precio muestra la fecha y hora en que se consultó. Las diferencias muy grandes se marcan para
              verificar en el súper.
            </p>
          </div>
          <div id="quien" className="rounded-xl border border-dashed border-black/15 bg-white/60 p-5 text-sm text-neutral-600">
            <h2 className="font-medium text-neutral-800">Quién lo hizo</h2>
            <p className="mt-1">
              Precios Super San Juan es un proyecto personal de <strong>{AUTHOR.name}</strong>. Es gratis, no pide
              registro y no está relacionado con ningún supermercado.
            </p>
            <p className="mt-2">
              ¿Viste un precio mal o un producto mal comparado? Escribime a{" "}
              <a href={`mailto:${AUTHOR.email}`} className="font-semibold text-emerald-700 underline">
                {AUTHOR.email}
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-4 text-xs text-neutral-500">
          <p>
            Precios obtenidos en tiempo real de las tiendas online. Carrefour, ChangoMás y La Anónima muestran
            el precio de su sucursal de San Juan; Vea y Átomo muestran su precio online, que puede diferir del
            de la góndola.
          </p>
          <p className="font-medium text-neutral-600">
            Sitio independiente, sin relación con los supermercados. Verificá el precio antes de comprar.
          </p>
        </div>
      </footer>
    </div>
  );
}
