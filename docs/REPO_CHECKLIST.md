# Repo Checklist (przed commitem)

## 1) Czego NIE commitować

- `.env.local`
- `.env.*` z prawdziwymi kluczami
- `.next/`
- `node_modules/`
- plików lokalnych narzędzi (`.claude/`, `.codex/`)

## 2) Co powinno być commitowane

- `.env.local.example` (bez sekretów)
- kod źródłowy: `app/`, `components/`, `lib/`
- migracje SQL: `db/migrations/VXXX__*.sql`
- dokumentacja: `README.md` + pliki w `docs/`

## 3) Check techniczny przed push

- TypeScript:

```bash
./node_modules/.bin/tsc --noEmit
```

- Szybki skan krzaków kodowania (windows-1250/utf-8):

```bash
rg "Ĺ|Ä|Ă|â" app components lib docs
```

- Sprawdzenie zmian:

```bash
git status
git diff --stat
```

## 4) Check biznesowy

- Zamówienie da się zapisać dla wielu pozycji (np. 37 jedynek + 8 dwójek).
- Wydanie aktualizuje `wydane`, `puste_zwrocono`, `zaplacono_kwota`.
- Bilans skrzynek klienta liczy się poprawnie.

## 5) Przed deployem

- Upewnij się, że migracje SQL zostały wykonane w Supabase w kolejności wersji.
- Upewnij się, że Vercel ma ustawione:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
