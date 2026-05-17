# Rzodkiewkowo

Aplikacja do zarządzania produkcją i dostawami rzodkiewki (folie, zasiewy, zbiory, zamówienia, dostawy, bilans skrzynek) oparta o Next.js + Supabase.

## Struktura dokumentacji

W katalogu głównym zostaje tylko ten plik (`README.md`).
Wszystkie pozostałe dokumenty są w `docs/`.

### Dokumenty projektowe

- Setup i uruchomienie: `docs/SETUP.md`
- Standard bazy danych: `docs/DB_STANDARD.md`
- Checklista repo/commitów: `docs/REPO_CHECKLIST.md`
- Zasady migracji SQL: `docs/MIGRATIONS.md`

### Dokumenty dla agentów AI

- Główne reguły agenta: `docs/ai/AGENTS.md`
- Kontekst dla Claude: `docs/ai/CLAUDE.md`

## Baza danych (migracje)

Migracje są w katalogu: `db/migrations/`.

Uruchamiaj je po kolei, rosnąco po wersji:

1. `V001__schema.sql`
2. `V002__rls.sql`
3. `V003__folie_mapa_columns.sql`
4. `V004__zbiory_ilosc_w_klatce.sql`
5. `V005__zamowienia_rozliczenia.sql`
6. `V006__zamowienia_klatki_model.sql`

## Szybki start

1. Uzupełnij `.env.local` na podstawie `.env.local.example`
2. Uruchom:

```bash
npm install
npm run dev
```

3. Otwórz `http://localhost:3000`
