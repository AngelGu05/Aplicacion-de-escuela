import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-page">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <h1>Página no encontrada</h1>
        <p className="muted">Lo que buscas no existe o ya no está disponible.</p>
        <Link href="/" className="btn btn-primary">Volver al inicio</Link>
      </div>
    </main>
  );
}
