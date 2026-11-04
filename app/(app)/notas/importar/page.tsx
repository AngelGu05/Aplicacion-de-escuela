import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPrefs, normPrefs } from "@/lib/notas";
import { ImportPanel } from "./ImportPanel";

export const metadata = { title: "Importar desde Seduca" };

export default async function ImportPage() {
  const profile = await requireUser();
  const prefs = normPrefs(await getPrefs(profile));
  const db = createAdminClient();
  const { data: subjects } = await db.from("grade_subjects").select("id, name").eq("user_id", profile.id).returns<{ id: string; name: string }[]>();
  const ids = (subjects ?? []).map((s) => s.id);
  const { data: items } = ids.length
    ? await db.from("grade_items").select("period").in("subject_id", ids).returns<{ period: number }[]>()
    : { data: [] as { period: number }[] };
  const lastPeriod = Math.max(1, ...(items ?? []).map((i) => i.period));

  return (
    <main className="container narrow">
      <nav className="crumbs"><Link href="/notas">Mis notas</Link> <span>/</span> Importar</nav>
      <section className="hero hero-sm">
        <span className="hero-kicker">📋 Copiar y pegar</span>
        <h1>Importar desde Seduca</h1>
        <p>Copia tu tabla de calificaciones de Seduca y pégala aquí: tus notas se llenan solas.</p>
      </section>

      <details className="card how-to">
        <summary><b>¿Cómo copio la tabla?</b> <span className="small muted">(o usa el <Link href="/conectar-seduca">botón 📥 Enviar a Aula</Link>, con un clic)</span></summary>
        <ol>
          <li>Abre Seduca en una <b>computadora</b> y entra a tus <b>calificaciones</b>.</li>
          <li>Con el mouse, selecciona la tabla desde la primera materia hasta la última nota de la última materia.</li>
          <li>Copia con <kbd>Ctrl</kbd> + <kbd>C</kbd> (en Mac <kbd>⌘</kbd> + <kbd>C</kbd>).</li>
          <li>Pégala abajo con <kbd>Ctrl</kbd> + <kbd>V</kbd>.</li>
        </ol>
        <p className="small muted">Hazlo una vez <b>por cada {prefs.period_label.toLowerCase()}</b>: en Seduca elige el {prefs.period_label.toLowerCase()}, copia la tabla, y aquí abajo elige el mismo número. Si lo vuelves a importar, solo se reemplaza ese {prefs.period_label.toLowerCase()}. Solo se guardan las notas; nadie más que tú puede verlas.</p>
      </details>

      <ImportPanel
        periods={prefs.periods} periodLabel={prefs.period_label} defaultPeriod={Math.min(prefs.periods, lastPeriod)}
        existing={(subjects ?? []).map((s) => s.name)} decimals={prefs.decimals}
      />
    </main>
  );
}
