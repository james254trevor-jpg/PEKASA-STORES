# Moving PEKASA STORE to a hosted database (Supabase)

## Why

Today every browser has its own private SQLite database. That means:

| Problem today | After the move |
| --- | --- |
| Clearing browser data, or losing the PC, erases the business records | Data lives in a managed Postgres database with automatic backups |
| Each computer sees different data; cashiers can't share a till view with the owners | One shared database for all computers and phones |
| Sign-in and "admin only" are checked in the browser, so they can be bypassed with browser tools | The **database** enforces who can do what (see the access rules below) |
| Passwords hashed with SHA-256 and one shared salt | Supabase Auth (bcrypt, rate limits, password reset, optional SMS/phone login) |
| Customer ID photos and numbers sit unencrypted in each browser | Stored server-side, encrypted at rest, behind login |

## What is already done (in this repo)

- `supabase/migrations/20261004000000_initial_schema.sql`: all 24 tables, translated from the SQLite schema in `src/db/sqlite.ts`, plus indexes.
- `supabase/migrations/20261004000100_row_level_security.sql`: the access rules.
  - Not signed in: no access to anything.
  - Active staff: read, add and edit day-to-day records; **cannot delete** them.
  - Cashiers: see and edit only their own till sessions and void requests; cannot see treasury, expenses, sales or the audit log.
  - Admins: everything, including treasury, expenses, collateral sales and staff accounts.
  - Ledger and audit log are **append-only** (no one can edit or delete a row, not even an admin).
  - Deactivated staff and logins with no staff record have no access.
- `supabase/tests/`: 38 checks of those rules, run against a real PostgreSQL server. I also broke the rules on purpose in six different ways to confirm the tests notice (they did).

Nothing in the app uses Supabase yet. The live system still runs on browser SQLite.

## Why the app can't just be switched over in one step

The app reads its data **synchronously** (`sqliteService.getCustomers()` returns immediately). A hosted
database is reached over the network, so every read becomes asynchronous. Today there are
**197 database calls in 17 files**, and **45 of them are raw SQL strings written inside screens**
(`sqliteService.run("UPDATE ...")`). Swapping them all at once, without being able to run the app
after each change, would be risky for a system that handles real money.

## Recommended path (each phase can be released on its own)

### Phase 0: Prepare (you, about 30 minutes)
1. Create a free project at supabase.com. Pick the region nearest to Kenya that is offered (check the region list when you create it; closer means faster).
2. In **SQL Editor**, run the two migration files in order. Do **not** run `supabase/tests/00_supabase_shim.sql` (that is only for plain-Postgres testing).
3. In **Authentication → Providers**, keep Email enabled. (Phone/SMS login can be added later.)
4. From **Project Settings → API**, note the project URL and the `anon` key. The `service_role` key is secret: it must only ever be used on the server, never in the app.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify/Vercel. (The anon key is designed to be public; the access rules protect the data.)

### Phase 1: Sign-in through Supabase Auth
- Replace the browser password check with `supabase.auth.signInWithPassword`.
- Create a login for each existing staff member and link it by setting `users.auth_user_id`. Staff set a **new** password; old hashes are not carried over.
- Keep the SMS code for cashiers: after the password step, `/api/otp-send` and `/api/otp-verify` still apply. Later, the OTP check can move fully server-side so a cashier session is only issued after the code is verified.
- Result: real logins, and the access rules start protecting the data.

### Phase 2: Move the data (the main work)
1. Add a thin data layer between the screens and the database (e.g. `src/data/*.ts`) with `async` functions: `listCustomers()`, `recordPayment()`, ...
2. Convert the 45 raw-SQL calls into named functions first (they are the riskiest), then the reads.
3. Do it one area at a time (customers → collateral → loans → payments/ledger → cashier sessions → treasury/expenses), shipping each.
4. For a smooth transition, load each area into memory at sign-in and write changes through to Supabase, so screens that still read synchronously keep working while they are converted.
5. Sequence numbers (`getNextSequence`: receipts, loan numbers, etc.) must become a **server-side function** so two cashiers can never get the same number.

### Phase 3: One-time import of existing data
- On the computer that holds the current data: **Backup → Export** (keep this file forever).
- Convert the export into rows for the new tables and import them. Dates are kept as text so nothing changes in the import.
- Run both systems side by side for a few days and compare totals (cash, loans outstanding, ledger sum) before switching off the old one.

### Phase 4: Photos
- Customer, ID and item photos are currently stored as base64 text inside the database (12 columns). Move them to **Supabase Storage** (private bucket, signed links) and store only the file path. This keeps the database small and fast.

### Phase 5: Hardening
- Convert text dates to `timestamptz`; add foreign keys once imported data is clean.
- Turn on Supabase's daily backups (paid plans) or schedule your own export.
- Add error monitoring and a staging project for trying changes safely.

## Known gaps in the access rules (decide before go-live)

- **Branch separation:** staff can see every branch's records. If branches must not see each other's data, add `branch_id = <user's branch>` to the policies.
- **Cashier edits to shared records:** cashiers can edit customers, loans and collateral (needed for daily work). Tighten per column or move sensitive changes behind admin approval functions if needed.
- **Manager role:** treated like other staff. Say if managers should get more (or fewer) powers.

## Costs

Supabase has a free tier that is enough to start, but free projects can be paused when idle and have no
daily backups, so use a paid plan for the live business. Check current limits and prices at
supabase.com/pricing. SMS for cashier codes is billed separately by your SMS provider.

## Running the access-rule tests yourself

On any PostgreSQL 15+ server (not on Supabase itself):

```bash
createdb pekasa_test
psql -d pekasa_test -v ON_ERROR_STOP=1 \
  -f supabase/tests/00_supabase_shim.sql \
  -f supabase/migrations/20261004000000_initial_schema.sql \
  -f supabase/migrations/20261004000100_row_level_security.sql \
  -f supabase/tests/10_rls_test.sql
```

A clean run ends with `ALL CHECKS PASSED`.
