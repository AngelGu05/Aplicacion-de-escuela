"use client";

import { useEffect } from "react";

/**
 * Pregunta al servidor cada 15 segundos (y al volver a la pestaña) si esta sesión sigue
 * siendo la activa. Si la cuenta se abrió en otro dispositivo, saca al usuario de inmediato.
 */
export function SessionGuard() {
  useEffect(() => {
    let stopped = false;
    async function check() {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/sesion", { cache: "no-store" });
        const data = (await res.json()) as { ok: boolean; redirect?: string };
        if (!data.ok && !stopped) {
          stopped = true;
          window.location.replace(data.redirect ?? "/login");
        }
      } catch {
        // Sin conexión: se vuelve a intentar en el siguiente ciclo.
      }
    }
    const timer = setInterval(check, 15000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
