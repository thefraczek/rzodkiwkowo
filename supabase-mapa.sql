-- Dodaj pola pozycji do tabeli folie
-- Uruchom w Supabase SQL Editor

alter table folie
  add column if not exists pos_x int not null default 20,
  add column if not exists pos_y int not null default 20,
  add column if not exists szerokosc int not null default 160,
  add column if not exists wysokosc int not null default 80,
  add column if not exists kolor text not null default '#86efac';
