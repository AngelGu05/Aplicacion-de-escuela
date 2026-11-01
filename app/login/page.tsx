import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Iniciar sesión" };

const MESSAGES: Record<string, { kind: "info" | "error"; text: string }> = {
  "otra-sesion": {
    kind: "info",
    text: "Tu cuenta se abrió en otro dispositivo, así que cerramos la sesión aquí. Solo se permite una sesión a la vez.",
  },
  terminada: {
    kind: "info",
    text: "Tu sesión terminó. Si no la cerraste tú, es posible que tu cuenta se haya abierto en otro dispositivo.",
  },
  suspendida: { kind: "error", text: "Esta cuenta está suspendida. Habla con tu profesor." },
  "sin-acceso": { kind: "error", text: "Esta cuenta no tiene acceso a la plataforma." },
  creado: { kind: "info", text: "Cuenta de administrador creada. Ya puedes iniciar sesión." },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const state = await getSessionState();
  if (state.status === "ok") redirect(state.profile.role === "admin" ? "/admin" : "/");

  const { motivo } = await searchParams;
  const message = motivo ? MESSAGES[motivo] : undefined;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand brand-lg">
          <span className="brand-mark" aria-hidden>⚛</span>
          <span>Aula de Ciencias</span>
        </div>
        <p className="muted">Física · Química · Biología</p>
        {message && <p className={`alert alert-${message.kind}`}>{message.text}</p>}
        <LoginForm />
        <p className="fine-print">¿No tienes cuenta? Pídesela a tu profesor.</p>
      </div>
    </main>
  );
}
