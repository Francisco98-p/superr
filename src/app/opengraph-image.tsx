import { ImageResponse } from "next/og";
import { STORE_IDS, STORES } from "@/lib/stores";

export const alt = "Precios Super San Juan: compará precios de supermercados";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px 80px",
          background: "linear-gradient(135deg, #047857 0%, #065f46 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 40, opacity: 0.85 }}>San Juan, Argentina</div>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05, marginTop: 16 }}>
            Precios Super San Juan
          </div>
          <div style={{ fontSize: 44, marginTop: 24, opacity: 0.95 }}>
            Buscá un producto y mirá en qué super está más barato
          </div>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          {STORE_IDS.map((id) => (
            <div
              key={id}
              style={{
                display: "flex",
                background: "white",
                color: STORES[id].color,
                fontSize: 34,
                fontWeight: 700,
                padding: "12px 26px",
                borderRadius: 999,
              }}
            >
              {STORES[id].name}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
