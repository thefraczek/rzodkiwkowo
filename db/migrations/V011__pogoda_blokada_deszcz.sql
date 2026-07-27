-- Pogoda: nie podlewaj, jeśli padało albo zapowiada się deszcz.
--
-- Dane z Open-Meteo (bez klucza API, darmowe). Odpytywane co 15 min przez pg_cron
-- + pg_net i cache'owane w tabeli `pogoda`. Sterownik NIE łączy się z pogodą —
-- decyzja zapada w bazie, więc nie zużywa danych z karty SIM.
--
-- Blokowane są TYLKO wpisy z harmonogramu (automat). Podlewanie ręczne i kolejka
-- przechodzą zawsze — skoro klikasz sam, to wiesz co robisz (appka tylko ostrzega).

create extension if not exists pg_net;

-- ---------------------------------------------------------------- tabela
-- Jeden wiersz (id = 1): konfiguracja + zbuforowane dane pogodowe.
create table if not exists pogoda (
  id                int primary key default 1 check (id = 1),

  -- KONFIGURACJA (edytowana z aplikacji)
  lat               numeric not null default 52.2297,  -- USTAW NA SWOJE POLE!
  lon               numeric not null default 21.0122,  -- USTAW NA SWOJE POLE!
  aktywna           boolean not null default true,     -- false = blokada wyłączona
  godzin_wstecz     int     not null default 12,       -- „czy padało" — ile godzin w tył
  godzin_naprzod    int     not null default 8,        -- „czy będzie padać" — ile godzin w przód
  prog_opad_wstecz  numeric not null default 3,        -- mm opadu w tył  -> nie podlewaj
  prog_opad_naprzod numeric not null default 2,        -- mm prognozy     -> nie podlewaj
  prog_szansa       int     not null default 60,       -- % szansy deszczu -> nie podlewaj

  -- CACHE (nadpisywane przez pogoda_odswiez())
  opad_wstecz       numeric,
  opad_naprzod      numeric,
  szansa_naprzod    int,
  temperatura       numeric,
  aktualizacja      timestamptz,
  blad              text,
  req_id            bigint                             -- id zapytania pg_net
);

insert into pogoda (id) values (1) on conflict (id) do nothing;

alter table pogoda enable row level security;

drop policy if exists pogoda_auth_all on pogoda;
create policy pogoda_auth_all on pogoda
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------- odświeżanie
-- pg_net jest ASYNCHRONICZNY: przy każdym wywołaniu najpierw parsujemy odpowiedź
-- na poprzednie zapytanie, potem wysyłamy nowe. Przy 15-minutowym cronie dane są
-- więc opóźnione o jeden cykl — dla decyzji „podlewać czy nie" to bez znaczenia.
create or replace function pogoda_odswiez() returns void
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  c       pogoda;
  r       record;
  j       jsonb;
  v_url   text;
  v_new   bigint;
  v_teraz timestamptz := now();
begin
  select * into c from pogoda where id = 1;
  if not found then return; end if;

  -- 1) odpowiedź na POPRZEDNIE zapytanie
  if c.req_id is not null then
    select status_code, content, error_msg, timed_out
      into r
      from net._http_response
     where id = c.req_id;

    if not found then
      null;                                   -- jeszcze nie wróciła (albo wygasła) — czekamy
    elsif r.timed_out or coalesce(r.status_code, 0) <> 200 then
      update pogoda
         set blad = coalesce(r.error_msg, 'HTTP ' || coalesce(r.status_code::text, '?'))
       where id = 1;
    else
      j := r.content::jsonb;

      -- godzinowe tablice -> sumy. Rozdział „przeszłość / przyszłość" po znaczniku
      -- czasu (a nie po liczbie elementów), więc jest odporny na zmiany w API.
      with h as (
        select (t.ts || 'Z')::timestamptz            as ts,
               nullif(p.opad, 'null')::numeric       as opad,
               nullif(pr.szansa, 'null')::numeric    as szansa
          from jsonb_array_elements_text(j -> 'hourly' -> 'time')
                 with ordinality t(ts, i)
          join jsonb_array_elements_text(j -> 'hourly' -> 'precipitation')
                 with ordinality p(opad, i) using (i)
          join jsonb_array_elements_text(j -> 'hourly' -> 'precipitation_probability')
                 with ordinality pr(szansa, i) using (i)
      )
      update pogoda set
        opad_wstecz    = (select coalesce(sum(opad),   0) from h where ts <= v_teraz),
        opad_naprzod   = (select coalesce(sum(opad),   0) from h where ts >  v_teraz),
        szansa_naprzod = (select coalesce(max(szansa), 0) from h where ts >  v_teraz),
        temperatura    = nullif(j -> 'current' ->> 'temperature_2m', '')::numeric,
        aktualizacja   = v_teraz,
        blad           = null
      where id = 1;
    end if;
  end if;

  -- 2) nowe zapytanie do Open-Meteo (bez klucza API)
  v_url := 'https://api.open-meteo.com/v1/forecast'
        || '?latitude='       || c.lat
        || '&longitude='      || c.lon
        || '&hourly=precipitation,precipitation_probability'
        || '&current=temperature_2m'
        || '&past_hours='     || c.godzin_wstecz
        || '&forecast_hours=' || c.godzin_naprzod
        || '&timezone=UTC';

  select net.http_get(url := v_url, timeout_milliseconds := 10000) into v_new;
  update pogoda set req_id = v_new where id = 1;
end;
$$;

-- ---------------------------------------------------------------- decyzja
-- Zwraca {"blokuje": bool, "powod": text|null}. Używane i przez trigger, i przez appkę.
create or replace function pogoda_blokuje() returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare c pogoda;
begin
  select * into c from pogoda where id = 1;

  if not found or not c.aktywna then
    return jsonb_build_object('blokuje', false, 'powod', null);
  end if;

  -- Dane nieświeże (>3 h) -> NIE blokujemy. Lepiej podlać niż nie podlewać nigdy
  -- z powodu zepsutego źródła pogody.
  if c.aktualizacja is null or c.aktualizacja < now() - interval '3 hours' then
    return jsonb_build_object('blokuje', false, 'powod', null);
  end if;

  if coalesce(c.opad_wstecz, 0) >= c.prog_opad_wstecz then
    return jsonb_build_object('blokuje', true,
      'powod', 'padało: ' || round(c.opad_wstecz, 1) || ' mm w ost. ' || c.godzin_wstecz || ' h');
  end if;

  if coalesce(c.opad_naprzod, 0) >= c.prog_opad_naprzod then
    return jsonb_build_object('blokuje', true,
      'powod', 'prognoza deszczu: ' || round(c.opad_naprzod, 1) || ' mm w ' || c.godzin_naprzod || ' h');
  end if;

  if coalesce(c.szansa_naprzod, 0) >= c.prog_szansa then
    return jsonb_build_object('blokuje', true,
      'powod', 'szansa na deszcz ' || c.szansa_naprzod || '% w ' || c.godzin_naprzod || ' h');
  end if;

  return jsonb_build_object('blokuje', false, 'powod', null);
end;
$$;

grant execute on function pogoda_blokuje() to authenticated;
grant execute on function pogoda_odswiez() to authenticated;   -- przycisk „Odśwież" w aplikacji

-- ---------------------------------------------------------------- blokada wpisów
alter table nawadnianie add column if not exists powod text;   -- dlaczego pominięto

alter table nawadnianie drop constraint if exists nawadnianie_status_check;
alter table nawadnianie add constraint nawadnianie_status_check
  check (status in ('oczekuje','w_trakcie','zakonczone','blad','wstrzymane','anulowane','pominiete'));

-- Zamiast po cichu nie tworzyć wpisu — tworzymy go ze statusem 'pominiete' i powodem,
-- żeby w aplikacji było widać, że harmonogram zadziałał, ale deszcz go wstrzymał.
create or replace function nawadnianie_deszcz() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare d jsonb;
begin
  if new.zrodlo <> 'harmonogram' then return new; end if;              -- ręczne/kolejka: bez blokady
  if coalesce(new.status, 'oczekuje') <> 'oczekuje' then return new; end if;

  d := pogoda_blokuje();
  if (d ->> 'blokuje')::boolean then
    new.status     := 'pominiete';
    new.powod      := d ->> 'powod';
    new.zakonczono := now();
  end if;
  return new;
end;
$$;

drop trigger if exists nawadnianie_deszcz on nawadnianie;
create trigger nawadnianie_deszcz
  before insert on nawadnianie
  for each row execute function nawadnianie_deszcz();

-- ---------------------------------------------------------------- cron (co 15 min)
select cron.unschedule('pogoda-odswiez')
 where exists (select 1 from cron.job where jobname = 'pogoda-odswiez');

select cron.schedule('pogoda-odswiez', '*/15 * * * *', $$ select pogoda_odswiez(); $$);

-- PO URUCHOMIENIU MIGRACJI:
--   1. Ustaw współrzędne swojego pola (albo zrób to w aplikacji):
--        update pogoda set lat = 52.1234, lon = 21.1234 where id = 1;
--   2. Pierwsze dane: wywołaj dwa razy (1. wysyła zapytanie, 2. czyta odpowiedź):
--        select pogoda_odswiez();   -- odczekaj ~10 s
--        select pogoda_odswiez();
--        select * from pogoda;
