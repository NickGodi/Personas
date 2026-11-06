create table if not exists public.card_ornament_settings (
  tier text primary key check (tier in (
    'lenda', 'challenger', 'grao_mestre', 'mestre', 'diamante', 'esmeralda',
    'platina', 'ouro', 'prata', 'bronze', 'ferro', 'madeira', 'criminoso'
  )),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.card_ornament_settings enable row level security;
revoke all on table public.card_ornament_settings from public, anon, authenticated;
grant select on table public.card_ornament_settings to anon, authenticated;
grant update (settings, updated_at) on table public.card_ornament_settings to authenticated;

drop policy if exists "Anyone can read shared card ornaments" on public.card_ornament_settings;
create policy "Anyone can read shared card ornaments"
  on public.card_ornament_settings for select to anon, authenticated
  using (true);

drop policy if exists "Only creator can update shared card ornaments" on public.card_ornament_settings;
create policy "Only creator can update shared card ornaments"
  on public.card_ornament_settings for update to authenticated
  using (
    exists (
      select 1 from public.profiles creator_profile
      where creator_profile.id = (select auth.uid())
        and creator_profile.role = 'criador'
    )
  )
  with check (
    exists (
      select 1 from public.profiles creator_profile
      where creator_profile.id = (select auth.uid())
        and creator_profile.role = 'criador'
    )
  );

insert into public.card_ornament_settings (tier) values
  ('lenda'), ('challenger'), ('grao_mestre'), ('mestre'), ('diamante'),
  ('esmeralda'), ('platina'), ('ouro'), ('prata'), ('bronze'), ('ferro'),
  ('madeira'), ('criminoso')
on conflict (tier) do nothing;
