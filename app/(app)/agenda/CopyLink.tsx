"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-link">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace del calendario" />
      <button type="button" className="btn btn-sm" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
      }}>{copied ? "¡Copiado!" : "Copiar"}</button>
    </div>
  );
}
