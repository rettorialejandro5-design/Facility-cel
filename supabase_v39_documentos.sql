-- v39: documentación de respaldo (PDF) por sede.
-- Espacio privado "documentos". Cada archivo va en una carpeta con el id de la sede:
--   <sede_id>/vencimientos/<n° de documento>/<archivo>.pdf
-- Ver: miembros de la sede. Subir y borrar: quienes pueden editar la sede (mismas reglas que public.datos).
-- Límite por archivo: 20 MB, solo PDF.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy documentos_ver on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         then public.puede_ver_sede(((storage.foldername(name))[1])::uuid) else false end);

create policy documentos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         then public.puede_editar_sede(((storage.foldername(name))[1])::uuid) else false end);

create policy documentos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         then public.puede_editar_sede(((storage.foldername(name))[1])::uuid) else false end);
