"use client";

import { useActionState } from "react";
import { login, type FormState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, undefined);

  return (
    <form action={action} className="form">
      <label className="field">
        <span>Correo</span>
        <input name="email" type="email" autoComplete="email" required placeholder="tu@correo.com" defaultValue={state?.values?.email} key={state?.values?.email} />
      </label>
      <label className="field">
        <span>Contraseña</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      <button className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
