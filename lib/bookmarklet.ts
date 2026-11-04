/**
 * Botón "📥 Enviar a Aula" (bookmarklet).
 * Se guarda como favorito en el navegador. Al tocarlo estando en Seduca:
 *  - en el Calendario: lee los eventos (con su fecha) que FullCalendar ya tiene cargados;
 *  - en Calificaciones: lee la tabla de notas (igual que copiar y pegar).
 * Luego abre Aula de Ciencias con los datos para que el alumno los revise y confirme.
 * No envía nada a ningún otro sitio y nunca toca la contraseña de Seduca.
 * (Escrito en JavaScript sencillo para que funcione en cualquier navegador.)
 */
const CODE = String.raw`(function(APP){try{
function pad(n){return ('0'+n).slice(-2)}
function dateOf(m){if(!m)return null;if(m.format)return m.format('YYYY-MM-DD');var d=new Date(m);if(isNaN(d))return String(m).slice(0,10);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function timeOf(e){try{if(e.allDay||!e.start||!e.start.hasTime||!e.start.hasTime())return null;return e.start.format('HH:mm')}catch(x){return null}}
function txt(el){return (el&&(el.innerText||el.textContent)||'').replace(/\s+/g,' ').trim()}
var out={v:1};
var head=document.querySelector('.bg-light h1,.bg-light .h3,.bg-light .m-n,h1,.h3');
out.salon=txt(head).slice(0,80);
var cal=document.querySelector('.fc');
if(cal){
 var evs=[];var jq=window.jQuery||window.$;
 try{if(jq&&jq.fn&&jq.fn.fullCalendar){jq(cal).fullCalendar('clientEvents').forEach(function(e){evs.push({t:String(e.title||''),d:dateOf(e.start),h:timeOf(e)})})}}catch(x){}
 if(!evs.length){
  [].forEach.call(cal.querySelectorAll('.fc-row'),function(row){
   var dates=[].map.call(row.querySelectorAll('.fc-content-skeleton thead td'),function(td){return td.getAttribute('data-date')});
   if(!dates.length||!dates[0])dates=[].map.call(row.querySelectorAll('.fc-bg td'),function(td){return td.getAttribute('data-date')});
   var occ={};
   [].forEach.call(row.querySelectorAll('.fc-content-skeleton tbody tr'),function(tr,ri){
    var col=0;
    [].forEach.call(tr.children,function(td){
     while(occ[ri+'_'+col])col++;
     var cs=td.colSpan||1,rs=td.rowSpan||1;
     for(var r=0;r<rs;r++)for(var c=0;c<cs;c++)occ[(ri+r)+'_'+(col+c)]=1;
     var a=td.querySelector('.fc-event');
     if(a&&dates[col])evs.push({t:txt(a.querySelector('.fc-title')||a),d:dates[col],h:null});
     col+=cs;
    });
   });
  });
  if(!evs.length)[].forEach.call(cal.querySelectorAll('.fc-event'),function(a){var p=a.closest('[data-date]');if(p)evs.push({t:txt(a.querySelector('.fc-title')||a),d:p.getAttribute('data-date'),h:null})});
 }
 if(!evs.length){alert('No encontré eventos en este calendario. Abre la agenda en la vista Mes y vuelve a tocar el botón.');return}
 out.tipo='agenda';out.eventos=evs;
 window.open(APP+'/agenda/importar#'+encodeURIComponent(JSON.stringify(out)),'_blank');return;
}
var tbl=null;
[].forEach.call(document.querySelectorAll('table'),function(t){var s=t.innerText||'';if(!tbl&&/Digitaci/i.test(s)&&/Apreciaci/i.test(s))tbl=t});
if(tbl){
 var lines=[];
 [].forEach.call(tbl.querySelectorAll('tr'),function(tr){
  var cells=[].map.call(tr.children,function(td,i){var s=(td.innerText||td.textContent||'');return i===0?s.replace(/\s+/g,' ').trim():s.replace(/\s+/g,'')});
  if(cells.length>1)lines.push(cells.join('\t'));
 });
 out.tipo='notas';out.texto=lines.join('\n');
 var b=null;
 [].forEach.call(document.querySelectorAll('select'),function(s){var o=s.options&&s.options[s.selectedIndex];var m=o&&/bimestre|periodo|trimestre/i.test(o.text)&&o.text.match(/\b(IV|III|II|I|[1-4])\b/);if(!b&&m)b=m[1]});
 if(b)out.bimestre={I:1,II:2,III:3,IV:4}[b]||Number(b);
 window.open(APP+'/notas/importar#'+encodeURIComponent(JSON.stringify(out)),'_blank');return;
}
alert('Abre en Seduca tu Calendario o tus Calificaciones y vuelve a tocar este botón.');
}catch(err){alert('No pude leer esta página de Seduca: '+err.message)}})`;

/** Código del favorito para una dirección concreta de la app. */
export function bookmarkletHref(appOrigin: string) {
  const code = `${CODE.replace(/\n/g, "")}(${JSON.stringify(appOrigin)})`;
  return `javascript:${encodeURIComponent(code)}`;
}

/** Lee lo que el botón dejó en la dirección (después del #). */
export function readBookmarkletPayload(): Record<string, unknown> | null {
  if (typeof window === "undefined" || !window.location.hash || window.location.hash.length < 3) return null;
  try {
    const data = JSON.parse(decodeURIComponent(window.location.hash.slice(1)));
    return data && typeof data === "object" && data.v === 1 ? data : null;
  } catch {
    return null;
  }
}
