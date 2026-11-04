"use client";

import { useEffect, useRef, useState } from "react";
import { bookmarkletHref } from "@/lib/bookmarklet";

/** El botón que se arrastra a favoritos. React no deja poner "javascript:" en un enlace, así que se pone al montar. */
export function BookmarkletButton() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const href = bookmarkletHref(window.location.origin);
    ref.current?.setAttribute("href", href);
    setCode(href);
  }, []);
  return (
    <div className="bm-wrap">
      <a ref={ref} className="bm-button" onClick={(e) => { e.preventDefault(); alert("Arrástrame a tu barra de favoritos 😉 (no hace falta hacer clic aquí)."); }} draggable>
        📥 Enviar a Aula
      </a>
      <span className="small muted">← arrástralo a tu barra de favoritos</span>
      <button type="button" className="btn btn-sm" disabled={!code} onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {} }}>
        {copied ? "¡Copiado!" : "Copiar código (para el celular)"}
      </button>
    </div>
  );
}
