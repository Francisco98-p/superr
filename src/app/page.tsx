import PriceSearch from "@/components/PriceSearch";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-emerald-700 text-white">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Precios Super San Juan</h1>
          <p className="mt-1 text-sm text-emerald-50 sm:text-base">
            Buscá un producto y compará al instante los precios de los supermercados de San Juan.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <PriceSearch initialQuery={initialQuery} />
      </main>

      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-4 text-xs text-neutral-500">
          <p>
            Precios obtenidos en tiempo real de las tiendas online. Carrefour y ChangoMás muestran el precio
            para San Juan; Vea y Átomo muestran su precio online, que puede diferir del de la góndola.
          </p>
          <p>Sitio independiente, sin relación con los supermercados. Verificá el precio antes de comprar.</p>
        </div>
      </footer>
    </div>
  );
}
