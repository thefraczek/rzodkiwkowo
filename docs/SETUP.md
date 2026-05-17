# Rzodkiewkowo - Setup

## 1. Supabase - baza danych

1. Wejdź na https://supabase.com i zaloguj się.
2. Kliknij **New project** i utwórz projekt.
3. W lewym menu kliknij **SQL Editor**.
4. Uruchom migracje z katalogu `db/migrations/` po kolei:
   - `V001__schema.sql`
   - `V002__rls.sql`
   - `V003__folie_mapa_columns.sql`
   - `V004__zbiory_ilosc_w_klatce.sql`
   - `V005__zamowienia_rozliczenia.sql`
   - `V006__zamowienia_klatki_model.sql`
5. W lewym menu kliknij **Settings > API** i skopiuj:
   - **Project URL**
   - **anon public key**

## 2. Klucze - plik .env.local

Stwórz plik `.env.local` obok `package.json`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TWOJ_PROJEKT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=twoj_anon_key
```

## 3. Uruchomienie lokalne

```bash
npm install
npm run dev
```

Otwórz `http://localhost:3000`.

## 4. Wdrożenie na Vercel

1. Zaloguj się do https://vercel.com przez GitHub.
2. Importuj repozytorium.
3. Dodaj env:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

## 5. Ważne uwagi

- Nigdy nie commituj `.env.local`.
- Każda zmiana bazy = nowa migracja w `db/migrations/` z kolejną wersją (`V007__...`).
- Po zmianie schematu zawsze aktualizuj:
  - `lib/types.ts`
  - UI/flow, którego dotyczy zmiana
