# Supabase cloud sync setup

PEKASA STORES keeps an SQLite database in the browser for local use. This integration stores a copy of that database under the signed-in Supabase Auth user and refreshes other signed-in devices about every three seconds while they are online.

## Set up the Supabase project

1. Open the Supabase SQL Editor for the project and run [`schema.sql`](./schema.sql).
2. In Authentication, enable Email and Password sign-in. If email confirmation is enabled, confirm the new store account before signing in.
3. The app is configured with this project's URL and publishable key in `src/lib/supabaseConfig.ts`. The publishable key is intended for browser use; never add a service-role or secret key to the app.
4. If the project has Data API schema exposure controls enabled, make sure the `public` schema is exposed. The migration grants the `authenticated` role access only to the sync table, and row-level security limits each account to its own row.

## Connect devices

1. On the phone or PC that currently has the store's data in its browser, open the app and choose **Create a new store account** (or sign into an existing one). Do this first so its local database becomes the initial cloud copy.
2. Wait for **Store account connected** to appear.
3. On the other device, open the same deployed app and sign in with the same Supabase email and password. Then sign into PEKASA with the existing staff account from the store database.

The Supabase store account is separate from the PEKASA staff login. Keep using the same Supabase account on every device that should share one store. While devices are online, new database rows from each device are merged automatically. If both devices edit the same row, the row with the latest update timestamp is kept. Sequence-generated reference numbers that collide are given a device suffix so both records can be retained. Cloud writes use a version check and retry if another device saves during the merge. Deletions are not yet synchronized as tombstones, so a deleted row can reappear if it is still present on another device.
