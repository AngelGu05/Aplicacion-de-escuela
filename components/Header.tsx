import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { Profile } from "@/lib/types";

export function Header({ profile }: { profile: Profile }) {
  const name = profile.full_name || profile.email;
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>⚛</span>
          <span>Aula de Ciencias</span>
        </Link>
        <nav className="topbar-nav">
          {profile.role === "admin" && (
            <Link href="/admin" className="nav-link">Panel</Link>
          )}
          <span className="user-chip" title={profile.email}>{name}</span>
          <form action={logout}>
            <button className="btn btn-ghost btn-sm">Salir</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
