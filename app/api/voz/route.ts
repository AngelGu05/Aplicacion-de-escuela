import { getSessionState } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Voz panameña natural (Azure Speech, voces es-PA).
 * La clave vive solo en el servidor: el navegador manda el texto y recibe el audio MP3.
 * Si no hay clave configurada, el asistente usa la voz del navegador como siempre.
 */
const VOCES = [
  "es-PA-MargaritaNeural", "es-PA-RobertoNeural",
  "es-MX-DaliaNeural", "es-MX-JorgeNeural", "es-CO-SalomeNeural", "es-CO-GonzaloNeural", "es-US-PalomaNeural", "es-US-AlonsoNeural",
  "en-US-AvaMultilingualNeural", "en-US-AndrewMultilingualNeural", "en-US-EmmaMultilingualNeural", "en-US-BrianMultilingualNeural",
] as const;
const MAX_CHARS = 700;

const key = () => process.env.AZURE_SPEECH_KEY?.trim();
const region = () => process.env.AZURE_SPEECH_REGION?.trim().toLowerCase().replace(/\s+/g, "");

// Freno simple por usuario (por instancia): evita que alguien gaste la cuota gratis.
const uso = new Map<string, { t: number; n: number }>();
function permitido(userId: string) {
  const now = Date.now();
  const u = uso.get(userId);
  if (!u || now - u.t > 60_000) { uso.set(userId, { t: now, n: 1 }); return true; }
  u.n++;
  return u.n <= 30;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET() {
  return Response.json({ enabled: !!(key() && region()), voces: VOCES });
}

export async function POST(request: Request) {
  const state = await getSessionState();
  if (state.status !== "ok") return Response.json({ error: "Inicia sesión" }, { status: 401 });
  const k = key(), r = region();
  if (!k || !r) return Response.json({ error: "Voz no configurada" }, { status: 503 });
  if (!permitido(state.profile.id)) return Response.json({ error: "Muchas solicitudes" }, { status: 429 });

  let text = "", voice: string = VOCES[0], rate = 1;
  try {
    const b = await request.json();
    text = String(b?.text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
    if ((VOCES as readonly string[]).includes(b?.voice)) voice = b.voice;
    const rr = Number(b?.rate);
    if (Number.isFinite(rr)) rate = Math.min(1.5, Math.max(0.7, rr));
  } catch {
    return Response.json({ error: "Solicitud no válida" }, { status: 400 });
  }
  if (!text) return Response.json({ error: "Sin texto" }, { status: 400 });

  const pct = Math.round((rate - 1) * 100);
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-PA"><voice name="${voice}">${voice.includes("Multilingual") ? `<lang xml:lang="es-MX">` : ""}<prosody rate="${pct >= 0 ? "+" : ""}${pct}%">${esc(text)}</prosody>${voice.includes("Multilingual") ? "</lang>" : ""}</voice></speak>`;

  const res = await fetch(`https://${r}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": k,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "aula-de-ciencias",
    },
    body: ssml,
  }).catch(() => null);

  if (!res || !res.ok) {
    const detalle = await res?.text().catch(() => "");
    console.error("Azure TTS:", res?.status, detalle);
    return Response.json({ error: "No se pudo generar la voz", azure: res?.status ?? 0 }, { status: 502 });
  }
  return new Response(await res.arrayBuffer(), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" },
  });
}
