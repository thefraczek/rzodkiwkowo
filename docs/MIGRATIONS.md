# Migracje bazy danych

Katalog `db/migrations/` zawiera wszystkie migracje SQL dla Supabase.

## Nazewnictwo

Każdy nowy plik musi mieć wersję:

`VXXX__krotki_opis.sql`

Przykład:

`V007__zamowienie_pozycje_table.sql`

## Kolejność wykonania

W SQL Editor uruchamiaj migracje po kolei, rosnąco po numerze wersji.

## Ważne

- Nie edytuj starych migracji po wdrożeniu na produkcji.
- Każda zmiana schematu = nowy plik z nową wersją.
- Po migracji zaktualizuj `lib/types.ts` i UI.
