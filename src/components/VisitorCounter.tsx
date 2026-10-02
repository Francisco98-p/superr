"use client";

import { useEffect, useState } from "react";

const COUNTED_KEY = "pssj-usuario-contado";
// Guards against React running the effect twice in development.
let requestStarted = false;

function alreadyCounted(): boolean {
  try {
    return localStorage.getItem(COUNTED_KEY) === "1";
  } catch {
    return false;
  }
}

function markCounted() {
  try {
    localStorage.setItem(COUNTED_KEY, "1");
  } catch {}
}

export default function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (requestStarted) return;
    requestStarted = true;

    const isNewUser = !alreadyCounted();
    fetch("/api/visitas", { method: isNewUser ? "POST" : "GET" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { value: number | null } | null) => {
        if (typeof data?.value !== "number") return;
        if (isNewUser) markCounted();
        setCount(data.value);
      })
      .catch(() => {});
  }, []);

  if (count === null || count < 1) return null;

  return (
    <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white sm:text-sm">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M16 11a4 4 0 1 0-3.999-4A4 4 0 0 0 16 11Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h7v-2.5c0-.85.33-2.34 2.37-3.47A12.4 12.4 0 0 0 8 13Zm8 0c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z" />
      </svg>
      {count.toLocaleString("es-AR")} {count === 1 ? "persona ya usó" : "personas ya usaron"} la web
    </p>
  );
}
