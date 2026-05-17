-- Dostawy/rozliczenia są zapisane bezpośrednio w tabeli zamowienia
ALTER TABLE zamowienia
  ADD COLUMN IF NOT EXISTS wydane boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_wydania date,
  ADD COLUMN IF NOT EXISTS puste_zwrocono integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS zaplacono_kwota decimal(10,2);

ALTER TABLE zamowienia
  ADD COLUMN IF NOT EXISTS klatki_jedynki integer,
  ADD COLUMN IF NOT EXISTS klatki_dwojki integer,
  ADD COLUMN IF NOT EXISTS peczkow_w_klatce integer DEFAULT 25;

UPDATE zamowienia
SET peczkow_w_klatce = COALESCE(peczkow_w_klatce, ilosc_w_klatce, 25)
WHERE peczkow_w_klatce IS NULL;

-- Jeżeli kiedyś utworzyłeś starą tabelę dostawy, możesz ją usunąć:
-- DROP TABLE IF EXISTS dostawy;
