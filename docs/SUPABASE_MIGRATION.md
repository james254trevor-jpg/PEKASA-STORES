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
- `supabase/migrations/20261004000100_row_level_security.sql`: first, simpler access rules (superseded by the next file, still safe to run first).
- `supabase/migrations/20261005000000_branch_separation_and_roles.sql`: the real access rules (below). It can be run on top of the previous file and can be re-run safely.
- `supabase/tests/`: 131 checks run against a real PostgreSQL server. I also broke the rules on purpose in eight different ways to confirm the tests notice (they did, every time).

Nothing in the app uses Supabase yet. The live system still runs on browser SQLite.

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

## Recommended path (each phase can be released on its own)

### Phase 0: Prepare (you, about 30 minutes)
1. Create a free project at supabase.com. Pick the region nearest to Kenya that is offered (check the region list when you create it; closer means faster).
2. In **SQL Editor**, run the three files in `supabase/migrations/` in order (oldest name first). Do **not** run anything in `supabase/tests/` (that is only for plain-Postgres testing). Your project is `jnyommgrfooxprzmagrw`, so its address is `https://jnyommgrfooxprzmagrw.supabase.co`.
3. In **Authentication → Providers**, keep Email enabled. (Phone/SMS login can be added later.)
4. From **Project Settings → API**, copy the `anon` (public) key. The `service_role` key is secret: it must only ever be used on the server, never in the app.
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

## Known gaps (decide before go-live)

- **Staff must be linked to a login.** Each staff row needs `auth_user_id` set and a `branch_id` (managers and cashiers without a branch see nothing). Directors can have any branch; they see all.
- **Cashier / manager edits inside a branch are not limited per column.** A manager with `can_issue_money` can edit any field of a loan in their branch. If specific changes (e.g. interest rate) need director approval, they should go through an approval step.
- **Customers registered before the move** need a branch. The import in Phase 3 should set it from their first loan or collateral item.
- **Number counters are shared across branches** and are still advanced by the app. They become a server-side function in Phase 2 so two people can never get the same number.

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
  -f supabase/migrations/20261005000000_branch_separation_and_roles.sql \
  -f supabase/tests/10_rls_test.sql
```

A clean run ends with `ALL CHECKS PASSED`.
