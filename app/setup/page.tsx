import { notFound } from "next/navigation";
import { adminExists } from "./actions";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración inicial" };

export default async function SetupPage() {
  if (await adminExists()) notFound();
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand brand-lg">
          <span className="brand-mark" aria-hidden>⚛</span>
          <span>Configuración inicial</span>
        </div>
        <p className="muted">
          Crea tu cuenta de administrador. Esta página desaparece en cuanto la crees.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
