"use client";

import { useActionState } from "react";
import { createFirstAdmin } from "./actions";
import type { FormState } from "../login/actions";

export function SetupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createFirstAdmin, undefined);
  return (
    <form action={action} className="form">
      <label className="field">
        <span>Tu nombre</span>
        <input name="full_name" placeholder="Profesor/a" />
      </label>
      <label className="field">
        <span>Correo</span>
        <input name="email" type="email" required />
      </label>
      <label className="field">
        <span>Contraseña (mínimo 8 caracteres)</span>
        <input name="password" type="password" minLength={8} required autoComplete="new-password" />
      </label>
      {state?.error && <p className="alert alert-error">{state.error}</p>}
      <button className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Creando…" : "Crear cuenta de administrador"}
      </button>
    </form>
  );
}
