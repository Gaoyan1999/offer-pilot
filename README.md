# Supabase Login Test

A minimal Next.js app that tests Supabase Google login and a protected database write.

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Add your Supabase project URL and publishable key to `.env.local`.

## Supabase

1. Run `supabase/schema.sql` in the Supabase SQL Editor.
2. In Supabase Dashboard, enable `Authentication > Providers > Google`.
3. Add this redirect URL in Supabase Auth settings:

```text
http://localhost:3000/auth/callback
```

For production, also add:

```text
https://your-domain.com/auth/callback
```

## Run

```bash
pnpm run dev
```

Open http://localhost:3000. After Google login, enter text on the home page and save it. Refreshing the page should load the same text from `public.user_notes`.

## Typecheck

```bash
pnpm run typecheck
```
