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

- `supabase/migrations/` (run in order, oldest name first):
  1. `20261004000000_initial_schema.sql`: all 24 tables, translated from `src/db/sqlite.ts`.
  2. `20261004000100_row_level_security.sql`: first, simpler access rules (superseded, still safe to run).
  3. `20261005000000_branch_separation_and_roles.sql`: branches kept apart, cashier < manager < admin.
  4. `20261006000000_sequences_and_login_challenges.sql`: receipt/loan numbers issued by the database (no duplicates between computers) and the sign-in-code bookkeeping.
  5. `20261006000100_otp_session_gate.sql`: the SMS step cannot be skipped (see "Cashier SMS code" below).
- `server/auth.ts` (+ `netlify/functions/auth.ts`, `api/auth/[action].ts`): sign-in, SMS code, create staff, reset password.
- `src/db/remote/`: the Supabase client, browser sign-in and the customers data layer. **Off by default.**
- `supabase/import/sqlite_to_sql.py`: turns a browser backup (`Backup -> Export`) into SQL for the new database.
- `supabase/tests/`: 131 access-rule checks, 46 number/code checks, 35 SMS-gate checks, a 200-way concurrency test and an import test, all run against a real PostgreSQL server (also run automatically in CI). Each rule was also broken on purpose to confirm the tests notice.

**Nothing is switched on.** The live system still runs on browser SQLite. The new code only activates
when `VITE_USE_SUPABASE=true`, and that must stay off until every area is converted and the data is
imported (see the next section).

## The access rules (enforced by the database)

**Branches are kept apart.** Everyone except admins can only see and change records of **their own branch** (`users.branch_id`). A staff member with no branch assigned sees nothing. Admins (the directors) see every branch.

**Roles follow the permission list you already maintain** (`user_roles.permissions_json`, edited in the app). The database reads it live, so ticking a permission for a role takes effect immediately, with no SQL:

| Permission | What it unlocks (own branch only) |
| --- | --- |
| `can_manage_appliances` | customers, collateral items, appliances, photos |
| `can_issue_money` | loans, and registering customers |
| `can_renew_loans` | loan renewals |
| `can_record_payments` | payments, invoices, ledger entries |
| `can_manage_parts` | parts, stock movements, suppliers |
| `can_manage_expenses` | operating expenses: view, add, edit |
| `can_authorize_sales` | collateral sales: view, add, edit |
| `can_view_financials` | read-only view of expenses and sales |

With the roles as the app defines them today:

| | Cashier | Manager | Admin |
| --- | --- | --- | --- |
| Branches | own | own | all |
| Read customers, collateral, loans, ledger | yes | yes | yes |
| Take payments, write ledger entries | yes | yes | yes |
| Own till, raise void requests | yes | yes | yes |
| Issue / renew loans, manage collateral and customers | no | yes | yes |
| Parts, suppliers, expenses, authorise collateral sales | no | yes | yes |
| See all tills of the branch, reconcile, approve void requests | no | yes | yes |
| Read the branch's staff list and audit log | no | yes | yes |
| Treasury (partners' capital) | no | **no** | yes |
| Create / change staff accounts, change role settings | no | **no** | yes |
| Delete records | no | **no** | yes |

Always true for everyone: the **ledger and audit log are append-only** (no one can edit or delete a row, not even an admin), deactivated staff lose access immediately, and anyone not signed in has no access at all.

### Decisions I made that you should confirm

1. **Customers belong to the branch that registered them** (the database adds the column and fills it in automatically). A customer's payments, invoices and appliances follow their branch.
   - A national ID number must be unique across the whole business, so branch 2 cannot register someone already registered at branch 1. That blocks a defaulter from simply re-registering elsewhere, but branch 2 staff will see a "duplicate" error and cannot see the other record. If you'd rather allow the same person at several branches, the ID uniqueness rule needs to become per-branch.
2. **Managers can authorise collateral sales** for their own branch, because that is how the app defines the manager role ("disposition authorizer"). The Collateral Sales screen currently says sales are reserved for the directors. If so, untick `can_authorize_sales` for managers.
3. **Managers cannot see the treasury**, because it holds the partners' own capital and retained profit in one shared record. They do see their branch's expenses and sales.
4. **Cashiers cannot issue loans, add collateral or register customers**, which matches the app's own cashier definition ("payment receipts, M-Pesa verification and ledger entry"). Today the counter screen offers a "+ Customer & Item" button to cashiers; once the app uses this database, that button must be hidden for cashiers, or you tick `can_issue_money` and `can_manage_appliances` for the cashier role.
5. **Parts and stock are per branch; suppliers are a shared list.** Number counters (receipts, loan numbers) are shared by all branches.

## Why the app can't just be switched over in one step

The app reads its data **synchronously** (`sqliteService.getCustomers()` returns immediately). A hosted
database is reached over the network, so every read becomes asynchronous. Today there are
**197 database calls in 17 files**, and **45 of them are raw SQL strings written inside screens**
(`sqliteService.run("UPDATE ...")`). Swapping them all at once, without being able to run the app
after each change, would be risky for a system that handles real money.

## Recommended path

**Important:** the phases below are *not* releasable one by one. If customers lived in Supabase while
loans and payments still lived in the browser, two databases would disagree (customers a loan can't
find, receipts that don't add up). So the app stays on browser SQLite, the Supabase code is built
behind the off-by-default switch, and the switch is turned on **once**, after every area is converted
and the data is imported and checked.

### Phase 0: Prepare (you, about 30 minutes)
1. Create a free project at supabase.com (project `jnyommgrfooxprzmagrw`, address `https://jnyommgrfooxprzmagrw.supabase.co`). Pick the region nearest to Kenya that is offered.
2. In **SQL Editor**, run the five files in `supabase/migrations/` in order. Do **not** run anything in `supabase/tests/`.
3. **Authentication -> Hooks -> Customize Access Token (JWT) Claims**: choose *Postgres function* -> `public.custom_access_token_hook` -> Save. Until this is on, cashiers stay locked out (a safe failure; admins and managers still work).
4. **Authentication -> Providers**: keep Email enabled. Every staff member needs a **real email address** (it is their login name; it can be the manager's shared address if they have no own).
5. **Project Settings -> API**: copy the `anon` key (public) and the `service_role` key (secret: server settings only, never in the app).
6. Hosting settings (Netlify/Vercel): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OTP_SECRET` and your SMS provider (see `.env.example`). Leave `VITE_USE_SUPABASE` unset for now.

### Phase 1: Sign-in through Supabase Auth (built; not yet wired into the sign-in screen)
- `server/auth.ts` provides login, SMS code, create staff, reset password; `src/db/remote/authApi.ts` is the browser side.
- **First administrator (director) bootstrap:** nobody can create the first admin through the app, because creating staff needs an admin. Once, in the dashboard: Authentication -> Users -> *Add user* (email + password, "auto confirm"), then in the SQL editor link that login to the staff row:
  `update public.users set auth_user_id = '<the new user's id>' where username = 'trevor';`
  (the imported data in Phase 3 contains the existing admin rows). After that, directors create everyone else from the app.

### Phase 2: Move the data (the main work, in progress)
1. Customers data layer: done (`src/db/remote/customers.ts`, tested with a fake server).
2. Still to convert, one area at a time: collateral, loans, payments/ledger, cashier sessions, treasury/expenses, sales, parts, users/roles. Convert the 45 raw-SQL calls inside screens into named functions first.
3. `getNextSequence` must become asynchronous and call `next_sequence` in the database (all 29 call sites change from `const x = getNextSequence(..)` to `await`).
4. Reads become asynchronous; screens load their data when opened.

### Phase 3: One-time import of existing data (script ready)
1. On the computer that holds the current data: **Backup -> Export** (keep this file forever).
2. `python3 supabase/import/sqlite_to_sql.py backup.sqlite --branch br-nairobi > import.sql`, check the printed row counts against the app, then run `import.sql` in the SQL editor (one transaction, safe to run twice).
3. Password hashes are **not** copied. Existing staff rows arrive without a login; link the director as in Phase 1 and create everyone else from the app.
4. Compare totals (cash, loans outstanding, ledger sum) between the old and new systems before switching `VITE_USE_SUPABASE=true`.

### Phase 4: Photos
- Customer, ID and item photos are base64 text inside the database (12 columns). Move them to **Supabase Storage** (private bucket, signed links) and keep only the path.

### Phase 5: Hardening
- Convert text dates to `timestamptz`; add foreign keys once imported data is clean.
- Turn on Supabase's daily backups (paid plans) or schedule your own export.
- Add error monitoring and a staging project.

## Cashier SMS code: why it cannot be skipped

The Supabase `anon` key is public, so anyone with a cashier's password could ask Supabase Auth for a
session directly and never see the SMS step. So the rule lives in the **database**: a cashier session gets
no data at all until the server marks that exact login session as code-verified (it appears as an
`otp_ok` claim in the token, added by the access-token hook; the mark lasts 12 hours). A stolen
password alone gives a locked-out session. Admins and managers do not need the code.

## Known gaps (decide before go-live)

- **Staff must be linked to a login.** Each staff row needs `auth_user_id` set and a `branch_id` (managers and cashiers without a branch see nothing). Directors can have any branch; they see all.
- **Cashier / manager edits inside a branch are not limited per column.** A manager with `can_issue_money` can edit any field of a loan in their branch. If specific changes (e.g. interest rate) need director approval, they should go through an approval step.
- **Customers registered before the move** need a branch. The import in Phase 3 should set it from their first loan or collateral item.
- **Number counters are shared across branches**; they are now issued by the database (`next_sequence`), so two people can never get the same number. Only an admin can edit a counter by hand.
- **Resetting a password does not end sessions already signed in** (they expire on their own). Deactivating a staff member does cut access at once.

## Costs

Supabase has a free tier that is enough to start, but free projects can be paused when idle and have no
daily backups, so use a paid plan for the live business. Check current limits and prices at
supabase.com/pricing. SMS for cashier codes is billed separately by your SMS provider.

## Running the database tests yourself

On any PostgreSQL 15+ server (not on Supabase itself). CI does exactly this on every push.

```bash
export PGDATABASE=pekasa_test; createdb $PGDATABASE
psql -v ON_ERROR_STOP=1 -q -f supabase/tests/00_supabase_shim.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -f supabase/tests/10_rls_test.sql
psql -v ON_ERROR_STOP=1 -q -f supabase/tests/20_sequences_and_otp_test.sql
supabase/tests/30_concurrency.sh
psql -v ON_ERROR_STOP=1 -q -f supabase/tests/40_otp_gate_test.sql
supabase/tests/50_import_test.sh
```

Each SQL test ends with `ALL CHECKS PASSED`. The server code is tested with `npm test` (no network needed).

## Not verified yet

Everything above was tested against a real PostgreSQL server and a fake Supabase, but **not** against
a live Supabase project (the exact request shapes of Supabase Auth and the access-token hook follow
Supabase's documentation). Expect to spend a short session with a real project to confirm the first
login end to end before wiring the screens.
