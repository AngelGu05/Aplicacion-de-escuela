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

export function ScienceBackdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="bd-blob bd-blob-1" />
      <div className="bd-blob bd-blob-2" />
      <div className="bd-blob bd-blob-3" />
      <div className="bd-grid" />
      {ITEMS.map((item, i) => (
        <div key={i} className={`bd-item bd-${item.tone}`} style={item.style}>
          {item.el}
        </div>
      ))}
    </div>
  );
}
