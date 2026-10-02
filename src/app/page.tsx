import Link from "next/link";
import PriceSearch from "@/components/PriceSearch";
import VisitorCounter from "@/components/VisitorCounter";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

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
        <PriceSearch key={initialQuery} initialQuery={initialQuery} />
      </main>

      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-4 text-xs text-neutral-500">
          <p>
            Precios obtenidos en tiempo real de las tiendas online. Carrefour, ChangoMás y La Anónima muestran
            el precio de su sucursal de San Juan; Vea y Átomo muestran su precio online, que puede diferir del
            de la góndola.
          </p>
          <p>Sitio independiente, sin relación con los supermercados. Verificá el precio antes de comprar.</p>
        </div>
      </footer>
    </div>
  );
}
