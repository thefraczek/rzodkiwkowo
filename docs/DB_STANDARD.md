# Standard bazy danych (Rzodkiewkowo)

## Cel

Utrzymać prostą, przewidywalną i bezpieczną strukturę bazy, która:
- działa stabilnie w Supabase,
- jest łatwa do migracji,
- nie wymusza przepisywania danych między tabelami.

## 1) Nazewnictwo

- Tabele: `snake_case`, liczba mnoga, bez polskich znaków.
- Kolumny: `snake_case`, bez polskich znaków.
- Klucze obce: `<encja>_id`.
- Daty: `data_*` dla dat biznesowych (np. `data_na_kiedy`, `data_wydania`), `created_at` dla technicznych.
- Flagi logiczne: nazwy bool (np. `wydane`) albo prefiks `is_` w nowych modułach.

## 2) Typy danych

- Identyfikatory: `integer` (serial) lub `bigint`.
- Kwoty: `decimal(10,2)`.
- Ilości: `integer`.
- Daty biznesowe: `date`.
- Znaczniki czasu systemowe: `timestamptz`.
- Teksty krótkie: `text` lub `varchar`.

## 3) Model zamówień (obecny standard)

Jedno zamówienie może mieć wiele pozycji typów (np. 37 jedynek i 8 dwójek).

Aktualnie pozycje zamówienia są trzymane w kolumnie `zamowienia.typ` jako JSON:

```json
[
  { "typ": "jedynka", "klatki": 37 },
  { "typ": "dwojka", "klatki": 8 }
]
```

Dodatkowo trzymamy pola agregatowe:
- `ilosc` (łączna liczba pęczków),
- `ilosc_w_klatce` (domyślnie 25),
- `cena_za_peczek`,
- `cena_calkowita`.

## 4) Rozliczanie dostaw i skrzynek

Rozliczenie jest trzymane bezpośrednio w `zamowienia`:
- `wydane` (bool),
- `data_wydania` (date),
- `puste_zwrocono` (int),
- `zaplacono_kwota` (decimal).

Bilans skrzynek per klient liczony jest jako:

`sum(klatki_wydane) - sum(puste_zwrocono)`

## 5) RLS i bezpieczeństwo

- Dla wszystkich tabel obowiązuje RLS.
- Aplikacja pracuje na koncie zalogowanym (Supabase Auth).
- Klucze i sekrety nigdy nie trafiają do repo.

## 6) Zmiany schematu (workflow)

Każda zmiana bazy musi mieć:
1. nowy plik migracji SQL w `db/migrations/`,
2. numer wersji w nazwie: `VXXX__opis.sql`,
3. aktualizację typów TS (`lib/types.ts`),
4. aktualizację UI/logiki, której dotyczy zmiana.

### Przykład

- `V007__zamowienie_pozycje_table.sql`

## 7) Czego nie robić

- Nie edytować historycznych migracji po wdrożeniu.
- Nie tworzyć „luźnych” plików SQL w root projektu.
- Nie dodawać migracji bez wersji.
