-- Dodaj ilosc_w_klatce do tabeli zbiory
ALTER TABLE zbiory ADD COLUMN IF NOT EXISTS ilosc_w_klatce integer;
