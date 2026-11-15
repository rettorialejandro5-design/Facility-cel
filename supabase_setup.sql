-- Facility CEL: ejecutar una vez en Supabase > SQL Editor
create table if not exists public.kv_store (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key        text not null,
  value      text,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.kv_store enable row level security;
drop policy if exists "own rows" on public.kv_store;
create policy "own rows" on public.kv_store
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- Usuarios: Authentication > Users > Add user (desactivá "Allow new users to sign up" en Auth > Providers > Email).
