"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { from: "yo" | "bot"; text: string; links?: { href: string; label: string }[]; action?: { type: "abrir"; href: string; label: string } };

const SUGERENCIAS = ["¿Qué tengo mañana?", "¿Cuánto necesito pa' pasar mate?", "¿Qué estudio hoy?", "¿Cómo voy en general?", "¿Qué día cae el 15?", "¿Qué tengo la otra semana?"];

/** Muestra **negritas** y *cursivas* sin usar HTML. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("*") && p.length > 2 ? <i key={i}>{p.slice(1, -1)}</i> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

/** Texto para leer en voz alta: sin asteriscos ni emojis, y con números que suenen bien. */
function paraVoz(text: string) {
  return text
    .replace(/\*+/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\b(\d)\.(\d)\b/g, "$1 punto $2")
    .replace(/pa'l\b/g, "pal")
    .replace(/pa'/g, "pa")
    .replace(/ta'/g, "ta")
    .replace(/\s+/g, " ")
    .trim();
}

type SR = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
};

export function Assistant({ firstName }: { firstName: string }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voz, setVoz] = useState(true);
  const [micOk, setMicOk] = useState(false);
  const recRef = useRef<SR | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    setMicOk(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    try { setVoz(localStorage.getItem("aula-voz") !== "0"); } catch { /* sin almacenamiento */ }
  }, []);

  useEffect(() => {
    if (open && !msgs.length) {
      setMsgs([{ from: "bot", text: `¡Xopá${firstName ? `, ${firstName}` : ""}! 👋 Soy tu asistente. Pregúntame por tu **agenda** o tus **notas**, escribiendo o con el 🎤.` }]);
    }
  }, [open, msgs.length, firstName]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  const hablar = useCallback((text: string) => {
    if (!voz || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(paraVoz(text));
    const voices = synth.getVoices();
    const pref = ["es-PA", "es-419", "es-MX", "es-US", "es-CO", "es-ES"];
    u.voice = pref.map((l) => voices.find((v) => v.lang.replace("_", "-") === l)).find(Boolean) ?? voices.find((v) => v.lang.startsWith("es")) ?? null;
    u.lang = u.voice?.lang ?? "es-419";
    u.rate = 1.03;
    synth.speak(u);
  }, [voz]);

  const preguntar = useCallback(async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { from: "yo", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/asistente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: text }) });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const r = (await res.json()) as Msg & { understood: boolean };
      setMsgs((m) => [...m, { from: "bot", text: r.text, links: r.links, action: r.action }]);
      hablar(r.text);
      if (/marqué como hecha/i.test(r.text)) router.refresh();
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: "Uy, no me pude conectar. Revisa tu internet e intenta otra vez." }]);
    } finally {
      setBusy(false);
    }
  }, [busy, hablar, router]);

  const escuchar = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) { recRef.current?.stop(); return; }
    window.speechSynthesis?.cancel();
    const rec = new Ctor();
    rec.lang = "es-PA";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    let triedFallback = false;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "language-not-supported" && !triedFallback) {
        triedFallback = true;
        rec.lang = "es-419";
        try { rec.start(); } catch { /* ya terminó */ }
        return;
      }
      if (e.error === "not-allowed") setMsgs((m) => [...m, { from: "bot", text: "Necesito permiso para usar el micrófono. Actívalo en el candadito 🔒 de la barra de direcciones." }]);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (finalText.trim()) preguntar(finalText);
    };
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  const toggleVoz = () => {
    setVoz((v) => {
      const nv = !v;
      try { localStorage.setItem("aula-voz", nv ? "1" : "0"); } catch { /* sin almacenamiento */ }
      if (!nv) window.speechSynthesis?.cancel();
      return nv;
    });
  };

  // No estorbar dentro de una lección
  if (/^\/materias\/[^/]+\/[^/]+/.test(path)) return null;

  return (
    <>
      {!open && (
        <button className="asis-fab" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }} aria-label="Abrir asistente">
          <span aria-hidden>🤖</span>
        </button>
      )}
      {open && (
        <section className="asis-panel" role="dialog" aria-label="Asistente">
          <header className="asis-head">
            <span className="asis-avatar" aria-hidden>🤖</span>
            <div className="asis-title"><b>Asistente</b><small>Notas y agenda</small></div>
            <button className={`asis-icon ${voz ? "is-on" : ""}`} onClick={toggleVoz} title={voz ? "Silenciar voz" : "Activar voz"} aria-label={voz ? "Silenciar voz" : "Activar voz"}>{voz ? "🔊" : "🔇"}</button>
            <button className="asis-icon" onClick={() => { setOpen(false); window.speechSynthesis?.cancel(); recRef.current?.abort(); }} aria-label="Cerrar">✕</button>
          </header>

          <div className="asis-list" ref={listRef} aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`asis-msg ${m.from === "yo" ? "is-me" : "is-bot"}`}>
                <p><Rich text={m.text} /></p>
                {(m.links?.length || m.action) && (
                  <div className="asis-links">
                    {m.action && <Link className="btn btn-primary btn-sm" href={m.action.href} onClick={() => setOpen(false)}>{m.action.label}</Link>}
                    {m.links?.map((l) => <Link key={l.href} className="btn btn-sm" href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>)}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="asis-msg is-bot"><p className="asis-typing"><span /><span /><span /></p></div>}
            {msgs.length <= 1 && (
              <div className="asis-sugs">
                {SUGERENCIAS.map((s) => <button key={s} className="asis-sug" onClick={() => preguntar(s)}>{s}</button>)}
              </div>
            )}
          </div>

          <form className="asis-input" onSubmit={(e) => { e.preventDefault(); preguntar(input); }}>
            {micOk && (
              <button type="button" className={`asis-mic ${listening ? "is-listening" : ""}`} onClick={escuchar} aria-label={listening ? "Dejar de escuchar" : "Hablar"} title="Hablar">
                {listening ? "■" : "🎤"}
              </button>
            )}
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Te escucho…" : "Pregúntame algo…"} maxLength={300} autoComplete="off" />
            <button className="asis-send" disabled={!input.trim() || busy} aria-label="Enviar">➤</button>
          </form>
        </section>
      )}
    </>
  );
}
