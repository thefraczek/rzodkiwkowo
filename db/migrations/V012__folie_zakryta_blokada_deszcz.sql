-- Blokada deszczowa dotyczy tylko folii ODKRYTYCH.
--
-- Tam gdzie folia jest ZAŁOŻONA, deszcz nie dochodzi do roślin — więc mimo opadu
-- trzeba podlewać normalnie. Znacznik jest per folia, bo część zagonów ma folię
-- założoną, a część nie, i to się zmienia w sezonie.
--
-- Uwaga: `folie.data_nalozenia` to tylko data informacyjna (nie mówi, czy folia jest
-- założona TERAZ — nie ma daty zdjęcia), dlatego potrzebny jest osobny znacznik.

alter table folie add column if not exists zakryta boolean not null default false;

comment on column folie.zakryta is
  'true = folia założona (przykryta). Deszcz nie dochodzi, więc blokada deszczowa jej nie dotyczy.';

-- Trigger jak w V011, ale z pominięciem folii przykrytych.
create or replace function nawadnianie_deszcz() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d         jsonb;
  v_zakryta boolean;
begin
  if new.zrodlo <> 'harmonogram' then return new; end if;              -- ręczne/kolejka: bez blokady
  if coalesce(new.status, 'oczekuje') <> 'oczekuje' then return new; end if;

  -- folia założona -> deszcz nie dochodzi -> podlewamy mimo opadu
  if new.folia_id is not null then
    select zakryta into v_zakryta from folie where id = new.folia_id;
    if coalesce(v_zakryta, false) then return new; end if;
  end if;

  d := pogoda_blokuje();
  if (d ->> 'blokuje')::boolean then
    new.status     := 'pominiete';
    new.powod      := d ->> 'powod';
    new.zakonczono := now();
  end if;
  return new;
end;
$$;
