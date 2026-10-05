# PEKASA STORE

Rehani (pawn) and second-hand goods management system with a public storefront.
Built with React + Vite + Tailwind. Staff manage customers, collateral, loans, payments,
the ledger, treasury and cashier sessions; customers see the public storefront.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests for the OTP service
npm run build      # production build into dist/
```

## Important: where your data lives today

The database is **SQLite running inside each browser** (stored in that browser's IndexedDB).

- Data is **not shared** between computers, and clearing browser data **erases it**.
- Use **Backup → Export** regularly and keep the `.sqlite` file somewhere safe.
- Moving to a hosted database is planned. See [`docs/SUPABASE_MIGRATION.md`](docs/SUPABASE_MIGRATION.md).

## Cashier sign-in codes (SMS)

Cashiers sign in with a password and then a 6-digit code **texted to the phone number saved on
their account**. The code is created and checked on the server (`server/otp.ts`) and is never
sent to the browser.

The functions are exposed at `/api/otp-send` and `/api/otp-verify` on both **Netlify**
(`netlify/functions/`) and **Vercel** (`api/`). Set these in your hosting settings
(never in the code or the repo). See `.env.example`:

| Setting | Meaning |
| --- | --- |
| `OTP_SECRET` | Long random string (32+ chars). `openssl rand -hex 32` |
| `INFOBIP_BASE_URL`, `INFOBIP_API_KEY` | Infobip SMS (used first if set) |
| `AT_USERNAME`, `AT_API_KEY` | Africa's Talking SMS (alternative) |
| `INFOBIP_SENDER` / `AT_SENDER_ID` | Optional sender name |
| `OTP_DEV_LOG` | `true` prints codes in the **server** log for local testing only |

Without a configured SMS provider, cashier sign-in fails safely; it never falls back to showing the code.

## Deploy

- **Netlify**: connect the repo. `netlify.toml` already sets the build command, `dist` folder and functions folder.
- **Vercel**: import the repo (Vite is detected automatically; `api/` becomes the functions).

Add the settings above, then redeploy.

## Project layout

```
src/
  App.tsx                 app shell, routing between views
  components/             screens (Customers, Loans, Collateral, Payments, Treasury, ...)
  components/Sidebar.tsx  left navigation (desktop); mobile uses the bar in Navbar.tsx
  navigation.ts           the role-based list of navigation links
  context/                AuthContext (sign-in, roles, OTP), ThemeContext (light/dark)
  db/sqlite.ts            browser SQLite database and all queries
  theme.css               light-mode colour layer (dark is the default)
server/otp.ts             SMS code generation + verification (+ otp.test.ts)
api/, netlify/functions/  thin wrappers that expose server/otp.ts on each host
supabase/                 hosted-database schema, branch + role access rules and tests (not yet used by the app)
docs/                     migration plan
```

## Light / dark mode

Dark is the default. Light mode re-points Tailwind's colour variables in `src/theme.css`, so
existing screens flip without per-component changes. Surfaces that must keep fixed colours
(brand buttons, receipts, the public storefront) carry the `theme-static` class or use brand colours.

## Known limitations

- Accounts and passwords are checked in the browser, so they protect against casual access but not
  against someone who knows how to edit browser data. A server database with real logins fixes this.
- The two admin accounts are created with fixed starting passwords in `src/db/sqlite.ts`. Change them,
  and plan to move to server-side accounts.
- Customer national ID numbers and ID photos are stored in the browser. Review Kenya's Data Protection
  Act 2019 obligations (registration with the Data Protection Commissioner, privacy notice).
- Storefront photos load from Unsplash. Replace them with your own photos in `public/` for reliability.
