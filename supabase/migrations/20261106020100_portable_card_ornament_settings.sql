insert into public.card_ornament_settings (tier, settings) values
  ('lenda', '{"showFrame":false,"scale":1.27,"heightScale":1.22,"topScale":0.8,"offsetX":0,"offsetY":8.5,"layer":"front"}'::jsonb),
  ('challenger', '{"showFrame":true,"scale":1.14,"heightScale":1.23,"topScale":0.8,"offsetX":0,"offsetY":9.5,"layer":"front"}'::jsonb),
  ('grao_mestre', '{"showFrame":true,"scale":1.1,"heightScale":1.38,"topScale":0.94,"offsetX":0,"offsetY":3,"layer":"front"}'::jsonb),
  ('mestre', '{"showFrame":true,"scale":1.15,"heightScale":1.25,"topScale":0.94,"offsetX":0,"offsetY":8.5,"layer":"front"}'::jsonb),
  ('diamante', '{"showFrame":true,"scale":1.12,"heightScale":1.28,"topScale":0.93,"offsetX":0,"offsetY":5.5,"layer":"front"}'::jsonb),
  ('esmeralda', '{"showFrame":true,"scale":1.16,"heightScale":1.31,"topScale":0.98,"offsetX":0,"offsetY":9,"layer":"front"}'::jsonb),
  ('platina', '{"showFrame":true,"scale":1.16,"heightScale":1.34,"topScale":0.94,"offsetX":0,"offsetY":7,"layer":"front"}'::jsonb),
  ('ouro', '{"showFrame":true,"scale":1.09,"heightScale":1.31,"topScale":0.94,"offsetX":0,"offsetY":7,"layer":"front"}'::jsonb),
  ('prata', '{"showFrame":true,"scale":1.3,"heightScale":1.14,"topScale":1.1,"offsetX":0,"offsetY":3,"layer":"front"}'::jsonb),
  ('bronze', '{"showFrame":true,"scale":1.34,"heightScale":1.06,"topScale":1.07,"offsetX":0,"offsetY":0,"layer":"front"}'::jsonb),
  ('ferro', '{"showFrame":true,"scale":1.32,"heightScale":1.03,"topScale":1.01,"offsetX":0,"offsetY":2,"layer":"front"}'::jsonb),
  ('madeira', '{"showFrame":true,"scale":1.35,"heightScale":1,"topScale":0.8,"offsetX":0,"offsetY":5.5,"layer":"front"}'::jsonb),
  ('criminoso', '{"showFrame":true,"scale":1.52,"heightScale":1,"topScale":0.8,"offsetX":0,"offsetY":5.5,"layer":"front"}'::jsonb)
on conflict (tier) do update set
  settings = excluded.settings,
  updated_at = now();
