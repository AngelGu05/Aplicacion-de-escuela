"use client";

import { useActionState, useEffect, useRef } from "react";
import { createStudent, resetPassword } from "../actions";
import type { FormState } from "@/app/login/actions";

function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function NewStudentForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createStudent, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="form card">
      <h2>Crear cuenta de alumno</h2>
      <div className="form-row">
        <label className="field"><span>Nombre</span><input name="full_name" placeholder="Nombre y apellido" defaultValue={state?.values?.full_name} key={"n" + (state?.values?.full_name ?? "")} /></label>
        <label className="field"><span>Correo</span><input name="email" type="email" required defaultValue={state?.values?.email} key={"e" + (state?.values?.email ?? "")} /></label>
      </div>
      <label className="field">
        <span>Contraseña</span>
        <div className="input-with-btn">
          <input ref={passRef} name="password" required minLength={8} autoComplete="off" />
          <button type="button" className="btn btn-sm" onClick={() => passRef.current && (passRef.current.value = randomPassword())}>Generar</button>
        </div>
      </label>
      <label className="check"><input type="checkbox" name="premium" /> Darle acceso Premium</label>
      {state?.error && <p className="alert alert-error">{state.error}</p>}
      {state?.ok && <p className="alert alert-info">{state.ok}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Creando…" : "Crear cuenta"}</button>
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, undefined);
  const passRef = useRef<HTMLInputElement>(null);
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <input ref={passRef} name="password" placeholder="Nueva contraseña" minLength={8} required autoComplete="off" />
      <button type="button" className="btn btn-sm" onClick={() => passRef.current && (passRef.current.value = randomPassword())}>Generar</button>
      <button className="btn btn-sm btn-primary" disabled={pending}>Cambiar</button>
      {state?.error && <span className="small text-error">{state.error}</span>}
      {state?.ok && <span className="small text-ok">{state.ok}</span>}
    </form>
  );
}
