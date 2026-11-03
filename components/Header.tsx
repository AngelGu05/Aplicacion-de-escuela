import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { Profile } from "@/lib/types";
import { NavLinks } from "./NavLinks";
import { canSeeLessons } from "@/lib/access";

export function Header({ profile, alerts }: { profile: Profile; alerts: number }) {
  const name = profile.full_name || profile.email;
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden>⚛</span>
            <span className="brand-text">Aula de Ciencias</span>
          </Link>
          <NavLinks isAdmin={profile.role === "admin"} alerts={alerts} variant="top" lessons={canSeeLessons(profile)} />
          <div className="topbar-user">
            <span className="user-chip" title={profile.email}>{name}</span>
            <form action={logout}>
              <button className="btn btn-ghost btn-sm">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <NavLinks isAdmin={profile.role === "admin"} alerts={alerts} variant="bottom" lessons={canSeeLessons(profile)} />
    </>
  );
}
