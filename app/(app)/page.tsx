import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Subject } from "@/lib/types";
import { canSeePremium, premiumAccess } from "@/lib/access";
import { eventsFor, kindInfo } from "@/lib/agenda";
import { addDays, daysBetween, relativeDay, shortTime, todayISO } from "@/lib/time";

const ICONS: Record<string, string> = { fisica: "🚀", quimica: "⚗️", biologia: "🧬" };

export default async function HomePage() {
  const profile = await requireUser();
  const db = createAdminClient();

  const [{ data: subjects }, { data: lessons }] = await Promise.all([
    db.from("subjects").select("*").order("position").returns<Subject[]>(),
    db.from("lessons").select("subject_id").eq("published", true).returns<{ subject_id: string }[]>(),
  ]);

  const today = todayISO();
  let upcoming: Awaited<ReturnType<typeof eventsFor>> = [];
  try {
    upcoming = (await eventsFor(profile, today, addDays(today, 7))).filter((e) => !e.done).slice(0, 5);
  } catch {
    upcoming = [];
  }

  const access = profile.role === "admin" ? "all" : await premiumAccess(profile);
  const counts = new Map<string, number>();
  lessons?.forEach((l) => counts.set(l.subject_id, (counts.get(l.subject_id) ?? 0) + 1));
  const firstName = (profile.full_name || "").split(" ")[0];

  return (
    <main className="container">
      <section className="hero">
        <span className="hero-kicker">Aula de Ciencias</span>
        <h1>
          {firstName ? <>Hola, <span className="hero-name">{firstName}</span> 👋</> : "¡Hola! 👋"}
        </h1>
        <p>¿Qué vamos a aprender hoy? Elige una materia para ver sus lecciones.</p>
      </section>

      {upcoming.length > 0 && (
        <section className="soon card">
          <div className="soon-head">
            <h2>🔔 Esta semana</h2>
            <Link href="/agenda" className="btn btn-ghost btn-sm">Ver agenda →</Link>
          </div>
          <ul className="soon-list">
            {upcoming.map((e) => {
              const left = daysBetween(today, e.event_date);
              return (
                <li key={e.id} className={`kind-${e.kind} ${left <= e.remind_days ? "is-reminder" : ""}`}>
                  <Link href={`/agenda?mes=${e.event_date.slice(0, 7)}&dia=${e.event_date}`}>
                    <span className="soon-icon" aria-hidden>{kindInfo(e.kind).icon}</span>
                    <span className="soon-title">
                      <b>{e.title}</b>
                      <small>{[kindInfo(e.kind).label, e.subject].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className="soon-when">{relativeDay(e.event_date, today)}{e.event_time ? ` · ${shortTime(e.event_time)}` : ""}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <h2 className="section-title">📚 Materias</h2>
      <div className="subject-grid">
        {(subjects ?? []).map((s) => {
          const n = counts.get(s.id) ?? 0;
          return (
            <Link key={s.id} href={`/materias/${s.slug}`} className="subject-card" style={{ "--accent": s.color } as React.CSSProperties}>
              <span className="subject-watermark" aria-hidden>{ICONS[s.slug] ?? "📘"}</span>
              <span className="subject-icon" aria-hidden>{ICONS[s.slug] ?? "📘"}</span>
              <h2>{s.name}</h2>
              {access !== "all" && canSeePremium(access, s.id) && <span className="access-chip is-on">⭐ Premium</span>}
              {s.description && <p>{s.description}</p>}
              <span className="subject-foot">
                <span className="subject-count">{n === 1 ? "1 publicación" : `${n} publicaciones`}</span>
                <span className="subject-go" aria-hidden>Entrar →</span>
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
