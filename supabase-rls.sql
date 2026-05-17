-- Wlacz RLS i dodaj polityki dla zalogowanych uzytkownikow
-- Uruchom w Supabase SQL Editor

do $$
declare
  t text;
begin
  foreach t in array array[
    'odbiorcy','folie','nasiona','sianie','zbiory',
    'zamowienia','nawozy_slownik','nawozenie','nawozenie_pozycje','opryski'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('
      create policy "Zalogowani maja pelny dostep" on %I
      for all to authenticated using (true) with check (true)
    ', t);
  end loop;
end;
$$;
