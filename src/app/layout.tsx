import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const title = "Precios Super San Juan | Compará precios de supermercados";
const description =
  "Compará precios de Carrefour, ChangoMás, La Anónima, Vea y Átomo en San Juan, Argentina. Encontrá dónde conviene comprar cada producto.";

export const metadata: Metadata = {
  metadataBase: new URL("https://precios-super-sanjuan.vercel.app"),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    locale: "es_AR",
    siteName: "Precios Super San Juan",
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
