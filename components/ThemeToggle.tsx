"use client";

import { useEffect, useState } from "react";

/** Cambia entre modo oscuro (por defecto) y claro. Se recuerda en este dispositivo. */
export function ThemeToggle() {
  const [tema, setTema] = useState<"dark" | "light">("dark");
  useEffect(() => { setTema(document.documentElement.dataset.theme === "light" ? "light" : "dark"); }, []);
  const cambiar = () => {
    const nuevo = tema === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nuevo;
    try { localStorage.setItem("aula-tema", nuevo); } catch { /* sin almacenamiento */ }
    setTema(nuevo);
  };
  return (
    <button className="theme-toggle" onClick={cambiar} title={tema === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} aria-label={tema === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
      {tema === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
