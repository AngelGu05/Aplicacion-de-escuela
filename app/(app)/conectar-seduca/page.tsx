import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { BookmarkletButton } from "./BookmarkletButton";

export const metadata = { title: "Conectar con Seduca" };

export default async function ConectarSeducaPage() {
  await requireUser();
  return (
    <main className="container narrow">
      <section className="hero hero-sm">
        <span className="hero-kicker">🔗 Seduca → Aula</span>
        <h1>Conectar con Seduca</h1>
        <p>Instala una vez el botón <b>📥 Enviar a Aula</b> y trae tu agenda y tus notas de Seduca con un clic.</p>
      </section>

      <section className="card">
        <h2 className="h-card">1. Instala el botón (una sola vez)</h2>
        <p className="small"><b>En la computadora (Chrome o Edge):</b> muestra la barra de favoritos con <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> y <b>arrastra</b> este botón hasta ella:</p>
        <BookmarkletButton />
        <details className="small">
          <summary>En el celular</summary>
          <ol>
            <li>Toca <b>Copiar código</b> aquí arriba.</li>
            <li>Guarda esta página en <b>favoritos</b> (★).</li>
            <li>Edita ese favorito: ponle de nombre <b>Enviar a Aula</b> y en la dirección (URL) <b>borra todo y pega</b> el código.</li>
            <li>Para usarlo: en Seduca, toca la barra de direcciones, escribe <b>Enviar a Aula</b> y toca el favorito que aparece.</li>
          </ol>
          <p className="muted">En el celular es más enredado; si puedes, usa la computadora.</p>
        </details>
      </section>

      <section className="card">
        <h2 className="h-card">2. Úsalo</h2>
        <ol className="steps-ol">
          <li>Primero entra a <b>Aula de Ciencias</b> en este navegador (con tu cuenta).</li>
          <li>Abre <b>Seduca</b> normal, con tu usuario de siempre.</li>
          <li>
            <b>Agenda:</b> entra al <b>Calendario</b> (vista <b>Mes</b>) y toca <b>📥 Enviar a Aula</b>. Si quieres el mes siguiente, avanza con la flecha → y tócalo otra vez.
          </li>
          <li><b>Notas:</b> entra a tus <b>Calificaciones</b> del bimestre y toca <b>📥 Enviar a Aula</b>.</li>
          <li>Se abre Aula con todo listo: revisa y pulsa <b>Importar</b>. ✅</li>
        </ol>
        <p className="small muted">
          Volver a importar <b>actualiza</b> sin duplicar. Lo que tú agregaste a mano no se toca.
        </p>
      </section>

      <section className="card">
        <h2 className="h-card">🔒 ¿Es seguro?</h2>
        <ul className="small">
          <li>Tú entras a Seduca como siempre: <b>Aula nunca ve ni guarda tu contraseña</b>.</li>
          <li>El botón solo lee lo que <b>ya está en tu pantalla</b>, igual que si lo copiaras, y te lo muestra para que lo confirmes.</li>
          <li>No envía nada a ningún otro sitio.</li>
        </ul>
      </section>

      <div className="hero-actions">
        <Link href="/agenda" className="btn">← Volver a la agenda</Link>
        <Link href="/notas" className="btn">Ir a mis notas</Link>
      </div>
    </main>
  );
}
