# Rzodkiewkowo - Setup

## 1. Supabase - baza danych

1. Wejdz na https://supabase.com i zaloguj sie
2. Kliknij **New project**, podaj nazwe "rzodkiewkowo"
3. W lewym menu kliknij **SQL Editor**
4. Wklej cala zawartosc pliku `supabase-schema.sql` i kliknij **Run**
5. W lewym menu kliknij **Settings > API**
6. Skopiuj:
   - **Project URL** (np. https://abcdefgh.supabase.co)
   - **anon public** key

## 2. Klucze - plik .env.local

Stworz plik `.env.local` w tym katalogu (obok package.json):

```
NEXT_PUBLIC_SUPABASE_URL=https://TWOJ_PROJEKT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=twoj_anon_key
```

## 3. Uruchomienie lokalnie

```bash
npm install
npm run dev
```

Otwórz http://localhost:3000

## 4. Wdrozenie na Vercel (hosting w sieci)

1. Zaloz konto na https://vercel.com przez GitHub
2. Wrzuc ten folder na GitHub (nowe repo)
3. Na Vercel kliknij **New Project**, wybierz repo
4. W sekcji **Environment Variables** dodaj:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Kliknij **Deploy**

Po deploymencie dostaniesz URL np. `rzodkiewkowo.vercel.app` dostepny z kazdego urzadzenia.

## Dostep dla innych uzytkownikow

Aplikacja jest publiczna (bez logowania). Jesli chcesz ograniczyc dostep, mozna pozniej dodac haslo przez Supabase Auth lub Vercel Password Protection.
