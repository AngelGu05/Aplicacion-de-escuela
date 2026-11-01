import { createAdminClient } from "@/lib/supabase/admin";

type LogRow = {
  id: number;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  user_id: string | null;
  profiles: { email: string; full_name: string | null } | null;
  lessons: { title: string } | null;
};

function device(ua: string | null) {
  if (!ua) return "—";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Otro";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return br ? `${os} · ${br}` : os;
}

export default async function AccessLogPage() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await createAdminClient()
    .from("access_logs")
    .select("id, ip, user_agent, created_at, user_id, profiles(email, full_name), lessons(title)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000)
    .returns<LogRow[]>();
  const logs = data ?? [];

  // Cuentas que entraron desde muchos lugares distintos (posible cuenta compartida).
  const byUser = new Map<string, { email: string; ips: Set<string>; devices: Set<string>; views: number }>();
  for (const l of logs) {
    if (!l.user_id) continue;
    const entry = byUser.get(l.user_id) ?? { email: l.profiles?.email ?? "?", ips: new Set(), devices: new Set(), views: 0 };
    if (l.ip) entry.ips.add(l.ip);
    entry.devices.add(device(l.user_agent));
    entry.views++;
    byUser.set(l.user_id, entry);
  }
  const suspicious = [...byUser.values()]
    .filter((u) => u.ips.size >= 4 || u.devices.size >= 3)
    .sort((a, b) => b.ips.size - a.ips.size);

  return (
    <>
      <section className="card">
        <h2>Posibles cuentas compartidas <span className="muted small">(últimos 7 días)</span></h2>
        {!suspicious.length ? (
          <p className="muted">Nada fuera de lo normal. 👍</p>
        ) : (
          <ul className="flag-list">
            {suspicious.map((u) => (
              <li key={u.email}>
                <strong>{u.email}</strong> — {u.ips.size} conexiones distintas, {u.devices.size} tipos de dispositivo, {u.views} lecciones abiertas
                <div className="muted small">{[...u.devices].join(", ")}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="section-title">Últimos accesos</h2>
      {!logs.length ? (
        <p className="empty-sm">Todavía no hay accesos registrados.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Alumno</th><th>Lección</th><th>Dispositivo</th><th>IP</th></tr></thead>
            <tbody>
              {logs.slice(0, 300).map((l) => (
                <tr key={l.id}>
                  <td className="nowrap">{new Date(l.created_at).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{l.profiles?.full_name || l.profiles?.email || "—"}</td>
                  <td>{l.lessons?.title ?? <span className="muted">(borrada)</span>}</td>
                  <td>{device(l.user_agent)}</td>
                  <td className="muted small">{l.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
