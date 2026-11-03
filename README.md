# Aula de Ciencias

Plataforma privada para publicar lecciones de **Física, Química y Biología**.

- Solo entran alumnos con cuenta (las crea el administrador).
- **Una sola sesión por cuenta:** si alguien entra desde otro dispositivo, el anterior se cierra solo.
- Las lecciones **no se pueden descargar** ni abrir fuera de la plataforma, y llevan una **marca de agua con el correo** de quien las ve.
- Cada lección puede ser **Libre** o **Premium**. El acceso Premium se da **por materia** (por ejemplo solo Física), con fecha de vencimiento opcional.
- Hay un **registro de accesos** con alertas de posibles cuentas compartidas.
- **Agenda** personal de cada alumno, que ya trae los exámenes y tareas de **su salón**; cada uno agrega lo suyo, marca como hecho, oculta, y recibe recordatorios (también en el calendario del celular).
- **Notas**: cada alumno anota sus calificaciones (privadas) y la página calcula cuánto necesita para pasar o llegar a su meta.
- **Asistente 🤖** por voz o texto (habla panameño): responde sobre la agenda y las notas de cada alumno y da recomendaciones. Las preguntas que no entiende se guardan sin nombre en *Panel → Asistente*. Sus frases y apodos de materias están en `lib/asistente/texto.ts`.

Tecnología: Next.js (en Vercel) + Supabase (cuentas y base de datos).

---

## Puesta en marcha (una sola vez)

### 1. Base de datos en Supabase

1. En [supabase.com](https://supabase.com), abre tu proyecto.
2. Ve a **SQL Editor → New query**, pega todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.
3. Abre otra **New query**, pega [`supabase/002_agenda_y_notas.sql`](supabase/002_agenda_y_notas.sql) y pulsa **Run** (agenda y notas). Luego lo mismo con [`supabase/003_asistente.sql`](supabase/003_asistente.sql) (asistente) y [`supabase/004_acceso_por_materia.sql`](supabase/004_acceso_por_materia.sql) (acceso Premium por materia).
4. Ve a **Authentication → Sign In / Providers** y **desactiva "Allow new users to sign up"**.
   Así nadie puede crearse una cuenta por su cuenta; solo tú desde el panel.

### 2. Copia las claves de Supabase

En **Project Settings**:

| Variable | Dónde está |
|---|---|
| `SUPABASE_URL` | Data API → **Project URL** |
| `SUPABASE_PUBLISHABLE_KEY` | API Keys → **Publishable key** (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | API Keys → **Secret key** (`sb_secret_…`). **No la compartas con nadie.** |

> Si tu proyecto muestra las claves antiguas, puedes usar la `anon` key como `SUPABASE_PUBLISHABLE_KEY` y la `service_role` como `SUPABASE_SECRET_KEY`.

### 3. Publica en Vercel

1. En [vercel.com](https://vercel.com): **Add New → Project** e importa este repositorio.
2. Antes de pulsar **Deploy**, abre **Environment Variables** y agrega las tres variables del paso 2.
3. Pulsa **Deploy**.

### 4. Crea tu cuenta de administrador

Abre `https://TU-PAGINA.vercel.app/setup` y crea tu cuenta.
Esa página **desaparece** en cuanto existe un administrador, así que hazlo justo después de publicar.

---

## Uso diario

**Publicar una lección:** Panel → Lecciones → **+ Nueva publicación** → elige la materia → sube el archivo `.html` de la lección (o escribe un aviso de texto) → Guardar.

**Crear alumnos:** Panel → Alumnos → escribe nombre, correo y contraseña (o pulsa *Generar*) → Crear cuenta. Pásale al alumno su correo y contraseña.

**Bloquear contenido:** en la lista de lecciones, pulsa **Libre / Premium** para cambiarla. En Alumnos, en la columna **Acceso Premium**, pulsa una materia para darle o quitarle acceso (⭐ = tiene acceso). En *Opciones* puedes dar acceso con **fecha de vencimiento** (por ejemplo, un mes pagado).

**Salones y agenda:** Panel → Alumnos → crea los salones (10°A, 10°B…) y asigna cada alumno a su salón. Lo que publiques en la Agenda para un salón le aparece a todos sus alumnos. Si marcas a un alumno como **Editor**, él también puede publicar eventos para su propio salón.

**Si un alumno se queja de que lo sacan:** su cuenta se está usando en otro dispositivo. Desde *Opciones* puedes cambiarle la contraseña, y eso cierra todas sus sesiones.

---

## Cómo se protege el contenido

1. Las lecciones se guardan en la base de datos, que **no es accesible desde el navegador** (solo el servidor puede leerla).
2. Cada vez que se abre una lección, el servidor revisa: ¿hay sesión? ¿es la sesión activa de la cuenta? ¿tiene permiso Premium?
3. Si todo está bien, envía la lección **con la marca de agua del alumno incrustada**, dentro de un marco aislado que no puede leer cookies ni descargar archivos.
4. Si alguien abre el enlace del contenido directamente o lo comparte, no ve nada.
5. Clic derecho, copiar, `Ctrl+S`, `Ctrl+P` e imprimir están bloqueados (esto es un freno para el alumno promedio, no una protección absoluta).

Lo que ninguna página puede impedir son las capturas o fotos de la pantalla; para eso está la marca de agua, que identifica de qué cuenta salió.

---

## Desarrollo local (opcional)

```bash
cp .env.example .env.local   # y rellena las claves
npm install
npm run dev
```
