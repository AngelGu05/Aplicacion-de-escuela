import type { Lesson } from "./types";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Convierte un aviso de texto en una página sencilla (con enlaces clicables). */
function renderNotice(lesson: Pick<Lesson, "title" | "content">) {
  const body = escapeHtml(lesson.content)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(lesson.title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 17px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 720px; margin: 0 auto; padding: 32px 20px 80px; }
  h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 1.2rem; }
  a { color: #2563eb; }
</style></head>
<body><h1>${escapeHtml(lesson.title)}</h1>
${body}
</body></html>`;
}

/** Marca de agua en SVG con el correo del alumno, repetida en diagonal. */
function watermarkDataUri(text: string) {
  const safe = escapeHtml(text);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200">
<text x="180" y="100" text-anchor="middle" dominant-baseline="middle" transform="rotate(-28 180 100)"
 font-family="system-ui, sans-serif" font-size="14" fill="rgba(128,128,128,0.16)">${safe}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PROTECTION_STYLE = `<style data-aula>
  html, body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  input, textarea, select, [contenteditable="true"] { -webkit-user-select: text; user-select: text; }
  @media print {
    html, body { background: #fff !important; }
    body > * { display: none !important; }
    body::after { content: "Contenido protegido — solo se puede ver en la plataforma."; display: block !important; font: 20px system-ui, sans-serif; padding: 40px; color: #000; }
  }
</style>`;

function protectionScript(watermarkUrl: string) {
  return `<script data-aula>
(function () {
  var WM_URL = ${JSON.stringify(watermarkUrl)};
  function makeMark() {
    var d = document.createElement("div");
    d.setAttribute("data-aula-wm", "");
    d.setAttribute("aria-hidden", "true");
    d.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;background-image:url(\\"" + WM_URL + "\\");background-repeat:repeat;";
    return d;
  }
  function ensureMark() {
    if (!document.body) return;
    var m = document.body.querySelector(":scope > [data-aula-wm]");
    if (!m || m.style.display === "none" || m.style.backgroundImage.indexOf("data:") === -1) {
      if (m) m.remove();
      document.body.appendChild(makeMark());
    } else if (document.body.lastElementChild !== m) {
      document.body.appendChild(m);
    }
  }
  function start() {
    ensureMark();
    new MutationObserver(ensureMark).observe(document.body, { childList: true, attributes: true, subtree: false });
    setInterval(ensureMark, 2000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  document.addEventListener("contextmenu", function (e) { e.preventDefault(); }, true);
  document.addEventListener("dragstart", function (e) { e.preventDefault(); }, true);
  document.addEventListener("copy", function (e) {
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    e.preventDefault();
  }, true);
  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === "s" || k === "p" || k === "u")) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  window.print = function () {};
})();
</script>`;
}

/**
 * Prepara una lección para enviarla al navegador de UN alumno:
 * le incrusta su marca de agua personal y las trabas anti-copia.
 */
export function buildLessonDocument(lesson: Lesson, viewerEmail: string) {
  let html = lesson.kind === "aviso" ? renderNotice(lesson) : lesson.content;

  if (!/<html[\s>]/i.test(html)) {
    html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`;
  }

  const date = new Date().toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" });
  const mark = watermarkDataUri(`${viewerEmail} · ${date}`);

  // Estilos al inicio del <head>, script al final del <body>.
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${PROTECTION_STYLE}`);
  } else {
    html = html.replace(/<html[^>]*>/i, (m) => `${m}<head>${PROTECTION_STYLE}</head>`);
  }

  const script = protectionScript(mark);
  const lastBody = html.toLowerCase().lastIndexOf("</body>");
  html = lastBody === -1 ? html + script : html.slice(0, lastBody) + script + html.slice(lastBody);

  return html;
}

export function simpleMessagePage(title: string, message: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>:root{color-scheme:light dark}body{font:16px/1.6 system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;padding:20px;text-align:center}h1{font-size:1.3rem;margin:0 0 .5rem}p{margin:0;opacity:.75}</style>
</head><body><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></body></html>`;
}
