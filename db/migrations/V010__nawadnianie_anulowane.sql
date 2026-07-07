-- Status 'anulowane' dla nawadniania (przerwanie trwającego podlewania)
--
-- Appka ustawia status = 'anulowane' na wierszu w_trakcie, gdy użytkownik
-- kliknie "Przerwij". KONTRAKT DLA STEROWNIKA (firmware):
--   1. W pętli, podczas trwającego podlewania, sterownik odpytuje status
--      swojego bieżącego zlecenia.
--   2. Jeśli status = 'anulowane' -> natychmiast zamyka zawór i ustawia
--      status = 'zakonczone' oraz zakonczono = now().
--
-- Zlecenia oczekujące appka anuluje przez DELETE (sterownik nigdy ich nie widzi).
--
-- CHECK constraint na kolumnie status trzeba rozszerzyc o 'anulowane', inaczej
-- UPDATE na 'anulowane' zostanie odrzucony. Domyslna nazwa to nawadnianie_status_check
-- — jesli u Ciebie jest inna, podmien ja w DROP ponizej. Sprawdzisz zapytaniem:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'nawadnianie'::regclass;
ALTER TABLE nawadnianie DROP CONSTRAINT IF EXISTS nawadnianie_status_check;
ALTER TABLE nawadnianie ADD CONSTRAINT nawadnianie_status_check
  CHECK (status IN ('oczekuje','w_trakcie','zakonczone','blad','wstrzymane','anulowane'));
