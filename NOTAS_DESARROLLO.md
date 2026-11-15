# Facility CEL: notas de desarrollo

> Versión pública, sin datos sensibles. La versión completa (usuarios, cuentas, SQL y plan de tareas)
> está en el OneDrive del dueño: `Facility CEL\v2\NOTAS_DESARROLLO.md`.
> Para retomar con Claude: "Leé NOTAS_DESARROLLO.md y seguimos". Al terminar, actualizar este archivo.
>
> Última actualización: 2026-11-15.

## Qué es
App de gestión de mantenimiento (Facility CEL). Publicada en https://facilitycel.com.ar con Cloudflare Pages,
que despliega automáticamente cada push a `main`. Base de datos, login y roles en Supabase. Mails de autenticación
por SMTP propio (Resend) desde `no-responder@facilitycel.com.ar`.

## Archivos
- `index.html`: la app completa. La parte de sesión e interfaz **no se edita a mano**: se genera con `build_index.py`.
- `cel-sync.js`: corre al inicio. Sesión, rol, sedes; carga los datos de la sede activa en localStorage y guarda cada cambio
  en `public.datos`. Login, "¿Olvidaste tu contraseña?" (mensaje genérico) y pantalla de contraseña nueva.
- `cel-ui.js`: corre al final. Encabezado (usuario · empresa / sede · rol), Cerrar sesión, Cambiar contraseña,
  selector de sede, modo Solo lectura (rol lector), Perfiles (`listar_miembros()`) y Auditoría.
- `build_index.py`: inserta `cel-sync.js` y `cel-ui.js` en `index.html` y aplica los textos de la v2. Idempotente.
  Toma la URL y la clave **anon** que ya están en `index.html`. Se detiene si encuentra `service_role`.
- `supabase_setup.sql`: esquema v1 (`kv_store`), se conserva sin uso.

## Modelo de datos (Supabase)
- `empresas`, `sedes`, `miembros (user_id, sede_id, rol)`, `plataforma_admins`, `datos (sede_id, key, value)`, `audit_log`.
- Roles: propietario de la plataforma (todas las sedes), `admin` (edita su sede y ve su auditoría), `operador` (edita su sede), `lector` (solo consulta).
- RLS en todas las tablas; la auditoría la escriben triggers.
- Claves de la app guardadas por sede: `celExtVerified`, `celExtClosed`, `celVisitDates`, `celPreventiveApproved`,
  `celPreventiveReports`, `celCorrectivePinsV1`, `facilityCEL_schedule_states_v14_three_states`,
  `facilityCEL_schedule_frequencies_v1`, `facilityCEL_custom_routines_v1`, `facilityCEL_custom_pin_positions_v1`.
- **Excepción:** los informes PDF preventivos quedan en IndexedDB del navegador (por usuario y sede), no en la nube.
- Los cambios de otros usuarios se ven al recargar. Si dos personas editan la misma sección a la vez, gana el último que guarda.

## Proceso de trabajo
1. Editar `cel-sync.js` / `cel-ui.js` (o `index.html` para lo que no es sesión/interfaz).
2. `python build_index.py`
3. Probar local: `python -m http.server 8765 --bind 127.0.0.1` → http://127.0.0.1:8765 (usa Supabase real).
4. Con OK del dueño: commit y push a `main`. Cloudflare publica en 1–3 minutos. Verificar en https://facilitycel.com.ar.

## Reglas
- Preguntar antes de crear o borrar algo en Supabase, Cloudflare, GitHub o Resend.
- Nunca usar ni publicar la clave `service_role`. En el navegador solo va la `anon`.
- Contraseñas, API keys y códigos los escribe el dueño; no van en chats, archivos ni commits.
- No pagar ni cambiar de plan sin preguntar.
- En la app, solo afirmaciones de seguridad que sean ciertas hoy.
- Informar con evidencia; no afirmar lo que no se verificó.

## Estado (v38, commit 86d762c)
- Hecho: base de datos v2 con RLS y auditoría; correo propio con plantillas en español; usuarios operador y lector asignados;
  pantallas v2 publicadas; GitHub Pages apagado.
- Probado: el propietario guarda y aparece en Auditoría; cerrar sesión limpia el navegador; enlace vencido;
  recuperación de contraseña del propietario en producción.
- Falta probar: operador (guarda, no ve Auditoría ni otras sedes); lector (solo lectura, escritura rechazada por la base,
  dos sesiones); otro navegador; otro usuario en el mismo navegador; Cambiar contraseña; auditoría con el email del operador.

## Próximos pasos
1. Terminar las pruebas pendientes en producción.
2. Informes PDF preventivos a la nube (preguntar antes de crear almacenamiento).
3. Evitar que dos usuarios se pisen cambios en la misma sección.
4. Con OK del dueño: repo privado (confirmar antes que Cloudflare Pages siga desplegando).
5. Opcionales: SSL "Full (strict)", favicon, decidir sobre `kv_store` (borrar solo con OK).
