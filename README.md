# CLOVER

A small group-expense PWA: add expenses, split them by percentage, see who owes whom and settle up.
Built to be installed on an iPhone from Safari (Share → Add to Home Screen) — no Mac, no App Store,
no paid developer account.

## Stack

TypeScript · Svelte 5 + Vite · plain CSS (matcha-green accents on a dim white background) ·
IndexedDB through Dexie · `vite-plugin-pwa` for the manifest and service worker.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server, also reachable from the phone on the same Wi-Fi |
| `npm test` | Unit tests for balances, rounding, debt simplification and the calculator |
| `npm run check` | Svelte/TypeScript check |
| `npm run build` | Production build into `dist/` |
| `npm run build:pages` | Production build for GitHub Pages (`/CLOVER/` base path) |
| `npm run icons` | Regenerate the app icons in `public/icons` |

## Testing on the phone

1. `npm run dev`, then open the printed `Network:` address in Safari on the phone.
2. Home Screen installation needs HTTPS, so install from the published site rather than the dev server.

## Publishing

Pushing to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`
(enable Pages with source "GitHub Actions" in the repository settings first).
Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as **repository variables** so the built
site can reach Supabase.

## Sync (Supabase)

1. Run [supabase/schema.sql](supabase/schema.sql) in the project's SQL editor. It creates the four
   tables, the row-level-security policies and the two join functions.
2. Copy `.env.example` to `.env` and fill in the project URL and anon key (already done locally).
3. Each person signs in with their own e-mail and password. The first phone creates the group;
   the other opens **Gå med i grupp**, pastes the invite code from Settings and picks their name.
4. Changes are queued in an outbox and pushed every few seconds; rows arriving from the server win
   when their `updated_at` is newer. Everything keeps working offline and catches up later.

## Project layout

```
src/lib/        data model (Dexie), balance maths, calculator, money formatting, app state, sync
src/components/ pages (Utgifter, Ställning), bottom bar, expense form, settle dialog, settings, login
scripts/        icon generator
supabase/       SQL schema with row-level security
tests/          unit tests for the money-critical logic
```

## How the money works

- Amounts are stored as whole öre (1 kr = 100 öre).
- Each share is rounded down to whole öre, and leftover öre go one at a time to the largest
  remainders, so shares always add up to the exact cost.
- `balance = what you paid − your share of everything`; balances in a group always sum to zero.
- Settling stores an expense paid by the person who owes, with 100 % on the person owed, so a
  partial payment simply moves both balances closer to zero.
- Debts are simplified by repeatedly pairing the largest debtor with the largest creditor.

## Status

All five phases of the plan are implemented: skeleton and PWA, local data, add/edit expense,
standings and settle, and sync with personal logins. The interface is in Swedish.
