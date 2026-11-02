import { requireUser } from "@/lib/auth";
import { eventsFor } from "@/lib/agenda";
import { daysBetween, addDays, todayISO } from "@/lib/time";
import { Header } from "@/components/Header";
import { SessionGuard } from "@/components/SessionGuard";
import { Assistant } from "@/components/Assistant";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  // Recordatorios: eventos pendientes que ya entraron en su ventana de aviso
  const today = todayISO();
  let alerts = 0;
  try {
    const soon = await eventsFor(profile, today, addDays(today, 14));
    alerts = soon.filter((e) => !e.done && daysBetween(today, e.event_date) <= e.remind_days).length;
  } catch {
    alerts = 0; // si la agenda aún no está creada en la base de datos, no rompe la página
  }
  return (
    <>
      <Header profile={profile} alerts={alerts} />
      <SessionGuard />
      {children}
      <Assistant firstName={(profile.full_name ?? "").split(" ")[0] ?? ""} />
    </>
  );
}
