"use client";

import { useEffect } from "react";

/** Muestra la lección dentro de un marco aislado y bloquea atajos de copiar/imprimir. */
export function ProtectedFrame({ lessonId, title }: { lessonId: string; title: string }) {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const keys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "s" || k === "p" || k === "u")) e.preventDefault();
    };
    document.addEventListener("contextmenu", block);
    document.addEventListener("keydown", keys);
    document.body.classList.add("no-print");
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("keydown", keys);
      document.body.classList.remove("no-print");
    };
  }, []);

  return (
    <iframe
      className="lesson-frame"
      src={`/api/leccion/${lessonId}`}
      title={title}
      // Sin "allow-same-origin": el contenido no puede leer cookies ni tocar la página.
      // Sin "allow-downloads": no se pueden descargar archivos desde la lección.
      sandbox="allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock"
      referrerPolicy="no-referrer"
      allow="fullscreen"
    />
  );
}
