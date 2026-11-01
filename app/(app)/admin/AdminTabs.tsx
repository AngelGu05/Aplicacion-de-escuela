"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Lecciones", match: (p: string) => p === "/admin" || p.startsWith("/admin/lecciones") },
  { href: "/admin/alumnos", label: "Alumnos", match: (p: string) => p.startsWith("/admin/alumnos") },
  { href: "/admin/registro", label: "Registro de accesos", match: (p: string) => p.startsWith("/admin/registro") },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={`tab ${t.match(path) ? "is-active" : ""}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
