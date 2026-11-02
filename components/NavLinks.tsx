"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  inicio: <path d="M3 11l9-7 9 7M5 10v10h14V10" />,
  agenda: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  notas: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  panel: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
};

export function NavLinks({ isAdmin, alerts, variant }: { isAdmin: boolean; alerts: number; variant: "top" | "bottom" }) {
  const path = usePathname();
  const items = [
    { key: "inicio", href: "/", label: "Materias", active: path === "/" || path.startsWith("/materias") },
    { key: "agenda", href: "/agenda", label: "Agenda", active: path.startsWith("/agenda"), badge: alerts },
    { key: "notas", href: "/notas", label: "Notas", active: path.startsWith("/notas") },
    ...(isAdmin ? [{ key: "panel", href: "/admin", label: "Panel", active: path.startsWith("/admin") }] : []),
  ];
  return (
    <nav className={variant === "top" ? "topnav" : "bottomnav"} aria-label="Secciones">
      {items.map((it) => (
        <Link key={it.key} href={it.href} className={`navitem ${it.active ? "is-active" : ""}`} aria-current={it.active ? "page" : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[it.key]}</svg>
          <span>{it.label}</span>
          {!!it.badge && <span className="nav-badge" aria-label={`${it.badge} recordatorios`}>{it.badge}</span>}
        </Link>
      ))}
    </nav>
  );
}
