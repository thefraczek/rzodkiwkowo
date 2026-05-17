-- Pola wydania bezpośrednio w zamówieniach (bez osobnej tabeli)
ALTER TABLE zamowienia
  ADD COLUMN IF NOT EXISTS wydane boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_wydania date,
  ADD COLUMN IF NOT EXISTS puste_zwrocono integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS zaplacono_kwota decimal(10,2);

-- Jeśli wcześniej utworzono tabelę dostawy, można ją usunąć:
-- DROP TABLE IF EXISTS dostawy;
