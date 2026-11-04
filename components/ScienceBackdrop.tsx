"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo decorativo con temática de ciencias: manchas de color de cada materia,
 * cuadrícula tipo papel milimetrado y dibujos flotando (átomo, matraz, ADN, parábola, molécula).
 * Es puramente decorativo: no recibe clics y lo ignoran los lectores de pantalla.
 */
const Atom = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2">
    <ellipse cx="32" cy="32" rx="28" ry="10" />
    <ellipse cx="32" cy="32" rx="28" ry="10" transform="rotate(60 32 32)" />
    <ellipse cx="32" cy="32" rx="28" ry="10" transform="rotate(120 32 32)" />
    <circle cx="32" cy="32" r="4.5" fill="currentColor" stroke="none" />
  </svg>
);

const Flask = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
    <path d="M24 6h16M27 6v16L12 50a6 6 0 0 0 5 9h30a6 6 0 0 0 5-9L37 22V6" />
    <path d="M17 42h30" />
    <circle cx="27" cy="50" r="2.5" fill="currentColor" stroke="none" />
    <circle cx="37" cy="47" r="1.8" fill="currentColor" stroke="none" />
  </svg>
);

const Dna = () => (
  <svg viewBox="0 0 64 96" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M14 4c0 22 36 22 36 44S14 70 14 92" />
    <path d="M50 4c0 22-36 22-36 44s36 22 36 44" />
    <path d="M20 14h24M26 24h12M20 34h24M20 62h24M26 72h12M20 82h24" opacity=".7" />
  </svg>
);

const Parabola = () => (
  <svg viewBox="0 0 96 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M6 58Q48-26 90 58" strokeDasharray="2 7" />
    <path d="M6 58h84" opacity=".6" />
    <circle cx="48" cy="16" r="5" fill="currentColor" stroke="none" />
    <path d="M6 58l14-20M14 38l6 0 0 6" />
  </svg>
);

const Molecule = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
    <path d="M32 8l20 12v24L32 56 12 44V20z" />
    <path d="M32 15l14 8.5M18 40.5V23.5M32 49l14-8.5" opacity=".7" />
    <circle cx="32" cy="8" r="4" fill="currentColor" stroke="none" />
    <circle cx="52" cy="44" r="4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="44" r="4" fill="currentColor" stroke="none" />
  </svg>
);

const Formula = ({ text }: { text: string }) => <span className="bd-formula">{text}</span>;

// [componente, clase de color, posición/tamaño, duración y retraso de la animación]
const ITEMS: Array<{ el: React.ReactNode; tone: string; style: React.CSSProperties }> = [
  { el: <Atom />, tone: "fis", style: { top: "9%", left: "4%", width: 92, animationDelay: "0s" } },
  { el: <Flask />, tone: "qui", style: { top: "62%", left: "7%", width: 78, animationDelay: "-4s" } },
  { el: <Dna />, tone: "bio", style: { top: "18%", right: "5%", width: 62, animationDelay: "-8s" } },
  { el: <Parabola />, tone: "fis", style: { bottom: "8%", right: "9%", width: 130, animationDelay: "-2s" } },
  { el: <Molecule />, tone: "qui", style: { top: "40%", right: "22%", width: 70, animationDelay: "-6s" } },
  { el: <Atom />, tone: "bio", style: { bottom: "14%", left: "38%", width: 58, animationDelay: "-10s" } },
  { el: <Molecule />, tone: "bio", style: { top: "6%", left: "48%", width: 50, animationDelay: "-3s" } },
  { el: <Flask />, tone: "fis", style: { top: "72%", right: "36%", width: 46, animationDelay: "-12s" } },
  { el: <Formula text="E = mc²" />, tone: "fis", style: { top: "30%", left: "16%", animationDelay: "-5s" } },
  { el: <Formula text="H₂O" />, tone: "qui", style: { bottom: "28%", right: "4%", animationDelay: "-9s" } },
  { el: <Formula text="ADN → ARN" />, tone: "bio", style: { top: "86%", left: "18%", animationDelay: "-7s" } },
  { el: <Formula text="F = m·a" />, tone: "fis", style: { top: "52%", left: "52%", animationDelay: "-11s" } },
];

/**
 * Partículas tipo "moléculas": flotan, se unen con líneas cuando están cerca,
 * se conectan al cursor/dedo y estallan en chispas al tocar el fondo.
 */
function useParticulas(canvasRef: React.RefObject<HTMLCanvasElement | null>, rootRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current, root = rootRef.current;
    if (!canvas || !root) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = getComputedStyle(document.documentElement);
    const colores = () => ["--fis", "--qui", "--bio"].map((v) => css.getPropertyValue(v).trim() || "#6c9bff");
    let pal = colores();

    let W = 0, H = 0, dpr = 1;
    type P = { x: number; y: number; vx: number; vy: number; r: number; c: number; vida?: number };
    let ps: P[] = [];
    const chispas: P[] = [];
    const mouse = { x: -9999, y: -9999, activo: false };

    const crear = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, Math.max(28, (W * H) / 16000)));
      ps = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: 1.2 + Math.random() * 2.2, c: Math.floor(Math.random() * 3),
      }));
    };

    const dibujar = () => {
      ctx.clearRect(0, 0, W, H);
      const oscuro = document.documentElement.dataset.theme !== "light";
      const alfa = oscuro ? 0.55 : 0.35;
      const dist = W < 640 ? 95 : 130;
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
        // El cursor atrae suavemente
        if (mouse.activo) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy);
          if (d < 180 && d > 1) { p.vx += (dx / d) * 0.012; p.vy += (dy / d) * 0.012; }
        }
        const v = Math.hypot(p.vx, p.vy);
        if (v > 0.9) { p.vx *= 0.9 / v; p.vy *= 0.9 / v; }
      }
      // Enlaces entre partículas cercanas
      ctx.lineWidth = 1;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i], b = ps[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < dist) {
            ctx.strokeStyle = pal[a.c];
            ctx.globalAlpha = (1 - d / dist) * alfa * 0.5;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        if (mouse.activo) {
          const a = ps[i], d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          if (d < 170) {
            ctx.strokeStyle = pal[a.c];
            ctx.globalAlpha = (1 - d / 170) * alfa;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
      }
      for (const p of ps) {
        ctx.globalAlpha = alfa + 0.2;
        ctx.fillStyle = pal[p.c];
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      // Chispas del clic
      for (let i = chispas.length - 1; i >= 0; i--) {
        const c = chispas[i];
        c.x += c.vx; c.y += c.vy; c.vx *= 0.96; c.vy *= 0.96; c.vida! -= 0.02;
        if (c.vida! <= 0) { chispas.splice(i, 1); continue; }
        ctx.globalAlpha = c.vida!;
        ctx.fillStyle = pal[c.c];
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0, corriendo = true;
    let cuadro = 0, enLeccion = false;
    const loop = () => {
      if (!corriendo) return;
      // Dentro de una lección el fondo queda tapado: no se anima (ahorra batería)
      if (cuadro++ % 30 === 0) enLeccion = !!document.querySelector(".lesson-frame");
      if (!enLeccion) dibujar();
      raf = requestAnimationFrame(loop);
    };

    const mover = (x: number, y: number) => {
      mouse.x = x; mouse.y = y; mouse.activo = true;
      root.style.setProperty("--mx", ((x / W) * 2 - 1).toFixed(3));
      root.style.setProperty("--my", ((y / H) * 2 - 1).toFixed(3));
    };
    const onMove = (e: PointerEvent) => mover(e.clientX, e.clientY);
    const onLeave = () => { mouse.activo = false; };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("a,button,input,select,textarea,label,summary,iframe,[role=dialog],.asis-panel,.card,table")) return;
      for (let i = 0; i < 22; i++) {
        const ang = (Math.PI * 2 * i) / 22 + Math.random() * 0.3, vel = 1.5 + Math.random() * 3;
        chispas.push({ x: e.clientX, y: e.clientY, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, r: 1.5 + Math.random() * 2, c: i % 3, vida: 1 });
      }
      // Empuja las partículas cercanas, como una onda
      for (const p of ps) {
        const dx = p.x - e.clientX, dy = p.y - e.clientY, d = Math.hypot(dx, dy);
        if (d < 200 && d > 1) { p.vx += (dx / d) * 1.6; p.vy += (dy / d) * 1.6; }
      }
    };
    const onVis = () => {
      corriendo = document.visibilityState === "visible";
      if (corriendo) { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
    };
    const onTheme = new MutationObserver(() => { pal = colores(); });

    crear();
    if (reduce) { dibujar(); return; }
    raf = requestAnimationFrame(loop);
    window.addEventListener("resize", crear);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    onTheme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      corriendo = false; cancelAnimationFrame(raf);
      window.removeEventListener("resize", crear);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      onTheme.disconnect();
    };
  }, [canvasRef, rootRef]);
}

export function ScienceBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useParticulas(canvasRef, rootRef);
  return (
    <div className="backdrop" aria-hidden="true" ref={rootRef}>
      <div className="bd-blob bd-blob-1" />
      <div className="bd-blob bd-blob-2" />
      <div className="bd-blob bd-blob-3" />
      <div className="bd-grid" />
      <canvas ref={canvasRef} className="bd-canvas" />
      {ITEMS.map((item, i) => (
        <div key={i} className={`bd-item bd-${item.tone}`} style={{ ...item.style, ["--d" as string]: `${((i % 4) + 1) * 9}px` }}>
          {item.el}
        </div>
      ))}
    </div>
  );
}
