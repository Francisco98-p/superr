import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Precios Super San Juan | Compará precios de supermercados",
  description:
    "Compará precios de Carrefour, ChangoMás, La Anónima, Vea y Átomo en San Juan, Argentina. Encontrá dónde conviene comprar cada producto.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
