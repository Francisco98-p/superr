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
      .then((data: { value: number | null; counted?: boolean } | null) => {
        if (typeof data?.value !== "number") return;
        if (isNewUser && data.counted) markCounted();
        setCount(data.value);
      })
      .catch(() => {});
  }, []);

  if (count === null || count < 1) return null;

  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-sm font-bold text-emerald-950 shadow-lg ring-2 ring-white/70 sm:text-base">
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-600 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-700" />
      </span>
      <span>
        <span className="text-lg tabular-nums sm:text-xl">{count.toLocaleString("es-AR")}</span>{" "}
        {count === 1 ? "sanjuanino ya usó" : "sanjuaninos ya usaron"} la web
      </span>
    </p>
  );
}
