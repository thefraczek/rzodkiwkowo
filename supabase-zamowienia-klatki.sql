-- Nowe kolumny dla zamówień klatkami
ALTER TABLE zamowienia
  ADD COLUMN IF NOT EXISTS klatki_jedynki integer,
  ADD COLUMN IF NOT EXISTS klatki_dwojki integer,
  ADD COLUMN IF NOT EXISTS peczkow_w_klatce integer DEFAULT 25;
