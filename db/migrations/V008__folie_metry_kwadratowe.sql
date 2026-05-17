-- Dodaj powierzchnie folii w metrach kwadratowych
ALTER TABLE folie
ADD COLUMN IF NOT EXISTS metry_kwadratowe numeric(10,2);
