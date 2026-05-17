-- Rzodkiewkowo - schemat bazy danych Supabase
-- Uruchom ten plik w Supabase SQL Editor

-- Odbiorcy
create table odbiorcy (
  id bigserial primary key,
  imie text,
  nazwisko text,
  ksywa text,
  tel text,
  miejsce_odbioru text,
  created_at timestamptz default now()
);

-- Folie
create table folie (
  id bigserial primary key,
  nazwa text not null,
  data_nalozenia date,
  created_at timestamptz default now()
);

-- Nasiona
create table nasiona (
  id bigserial primary key,
  nazwa text not null
);

-- Sianie
create table sianie (
  id bigserial primary key,
  folia_id bigint references folie(id) on delete set null,
  nasiona_id bigint references nasiona(id) on delete set null,
  data date not null,
  uwagi text,
  created_at timestamptz default now()
);

-- Zbiory
create table zbiory (
  id bigserial primary key,
  folia_id bigint references folie(id) on delete set null,
  data_zbioru date not null,
  ilosc_klatek int,
  uwagi text,
  created_at timestamptz default now()
);

-- Zamowienia
create table zamowienia (
  id bigserial primary key,
  odbiorca_id bigint references odbiorcy(id) on delete set null,
  data_na_kiedy date,
  data_utworzenia timestamptz default now(),
  ilosc int,
  typ text,
  ilosc_w_klatce int,
  cena_za_peczek numeric(10,2),
  cena_calkowita numeric(10,2),
  uwagi text
);

-- Slownik nawozow
create table nawozy_slownik (
  id bigserial primary key,
  nazwa text not null
);

-- Nawozenie (aplikacja nawozow do folii)
create table nawozenie (
  id bigserial primary key,
  folia_id bigint references folie(id) on delete set null,
  data date not null,
  uwagi text,
  created_at timestamptz default now()
);

-- Pozycje nawozenia
create table nawozenie_pozycje (
  id bigserial primary key,
  nawozenie_id bigint references nawozenie(id) on delete cascade,
  nawoz_id bigint references nawozy_slownik(id) on delete set null,
  ilosc numeric(10,3),
  jednostka text check (jednostka in ('kg', 'g'))
);

-- Opryski
create table opryski (
  id bigserial primary key,
  folia_id bigint references folie(id) on delete set null,
  data date not null,
  preparat text,
  uwagi text,
  created_at timestamptz default now()
);

-- Przykladowe dane startowe
insert into nasiona (nazwa) values ('Rzodkiewka Saxa'), ('Rzodkiewka Rowa'), ('Rzodkiewka Cherry Belle');
insert into nawozy_slownik (nazwa) values ('Polifoska 6'), ('Saletra amonowa'), ('Mocznik'), ('Superfosfat');
