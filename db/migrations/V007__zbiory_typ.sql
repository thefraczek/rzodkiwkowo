-- Dodaj typ rzodkiewki do zbiorow
ALTER TABLE zbiory
ADD COLUMN IF NOT EXISTS typ text;

UPDATE zbiory
SET typ = 'jedynka'
WHERE typ IS NULL;

