-- Zamówienia pod model pozycji (bez nowych kolumn w zamowienia)
-- typ przechowuje JSON, np:
-- [{"typ":"jedynka","klatki":37},{"typ":"dwojka","klatki":8}]

-- Dostawy/rozliczenie per zamówienie
ALTER TABLE zamowienia
  ADD COLUMN IF NOT EXISTS wydane boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_wydania date,
  ADD COLUMN IF NOT EXISTS puste_zwrocono integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS zaplacono_kwota decimal(10,2);

-- domyślna ilość pęczków w klatce dla starszych rekordów
UPDATE zamowienia
SET ilosc_w_klatce = COALESCE(ilosc_w_klatce, 25)
WHERE ilosc_w_klatce IS NULL;
