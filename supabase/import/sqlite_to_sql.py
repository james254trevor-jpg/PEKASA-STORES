#!/usr/bin/env python3
"""
PEKASA STORE - turn a browser backup (.sqlite file from Backup -> Export) into SQL for Supabase.

    python3 supabase/import/sqlite_to_sql.py backup.sqlite --branch br-nairobi > import.sql
    psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f import.sql

(or paste import.sql into the Supabase SQL editor; it runs as one transaction: all or nothing)

What it does and does not do:
  * Copies every row of every table the Supabase schema knows about. Columns the Supabase schema does
    not have are dropped. This is how password hashes and salts are NOT copied: logins live in
    Supabase Auth now (staff accounts are re-created from the app, with new passwords).
  * Rows that already exist (same id) are left alone, so running it twice is safe.
  * Customers, parts and audit entries get the branch given by --branch (the old data had no branches).
  * Ledger and audit rows are inserted as they are; the database keeps them append-only afterwards.
  * Sequence counters are copied, so new receipt/loan numbers continue after the old ones.
  * Prints a summary (rows per table, dropped columns) to stderr. Cross-check it against the app first.
"""
import argparse
import glob
import os
import re
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MIGRATIONS = os.path.join(HERE, '..', 'migrations')

# parents before children; ledger and audit last
ORDER = [
    'user_roles', 'branches', 'users', 'customers', 'ltv_configs', 'suppliers', 'treasury',
    'appliances', 'collateral_items', 'rehani_loans', 'loan_renewals', 'cashier_sessions',
    'payments', 'ledger_transactions', 'collateral_sales', 'operating_expenses', 'appliance_photos',
    'invoices', 'invoice_items', 'parts', 'stock_movements', 'payment_void_requests',
    'sequence_counters', 'audit_logs',
]
BRANCHED = {'customers', 'parts', 'audit_logs'}


def pg_columns():
    """Column names per table, read from the migration files (create table + add column)."""
    cols = {}
    for path in sorted(glob.glob(os.path.join(MIGRATIONS, '*.sql'))):
        sql = open(path, encoding='utf-8').read()
        sql = re.sub(r'--[^\n]*', '', sql)
        for m in re.finditer(r'create table if not exists public\.(\w+)\s*\((.*?)\n\);', sql, re.S | re.I):
            names = set()
            for line in m.group(2).split('\n'):
                line = line.strip().rstrip(',')
                w = re.match(r'(\w+)\s+\w+', line)
                if w and w.group(1).lower() not in ('primary', 'unique', 'constraint', 'foreign', 'check'):
                    names.add(w.group(1))
            cols.setdefault(m.group(1), set()).update(names)
        for m in re.finditer(r'alter table public\.(\w+)\s+add column if not exists (\w+)', sql, re.I):
            cols.setdefault(m.group(1), set()).add(m.group(2))
    return cols


def lit(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return '1' if v else '0'
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, bytes):
        return "'\\x" + v.hex() + "'::bytea"
    return "'" + str(v).replace("'", "''").replace('\x00', '') + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('backup')
    ap.add_argument('--branch', required=True, help='branch id for customers/parts/audit entries, e.g. br-nairobi')
    a = ap.parse_args()

    known = pg_columns()
    db = sqlite3.connect(f'file:{a.backup}?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    have = {r[0] for r in db.execute("select name from sqlite_master where type='table'")}

    out = ['begin;']
    summary, dropped = [], {}
    for t in ORDER:
        if t not in have or t not in known:
            continue
        scols = [r[1] for r in db.execute(f'pragma table_info("{t}")')]
        keep = [c for c in scols if c in known[t]]
        if set(scols) - set(keep):
            dropped[t] = sorted(set(scols) - set(keep))
        extra = t in BRANCHED and 'branch_id' not in keep
        cols = keep + (['branch_id'] if extra else [])
        n = 0
        for row in db.execute(f'select {", ".join(chr(34) + c + chr(34) for c in keep)} from "{t}"'):
            vals = [lit(row[c]) for c in keep] + ([lit(a.branch)] if extra else [])
            out.append(f'insert into public.{t} ({", ".join(cols)}) values ({", ".join(vals)}) on conflict do nothing;')
            n += 1
        summary.append((t, n))
    out.append('commit;')
    print('\n'.join(out))

    print('rows per table:', file=sys.stderr)
    for t, n in summary:
        print(f'  {t:24} {n}', file=sys.stderr)
    for t, c in dropped.items():
        print(f'  dropped columns of {t}: {", ".join(c)}', file=sys.stderr)
    unknown = sorted(have - set(ORDER) - {'sqlite_sequence'})
    if unknown:
        print(f'  NOT imported (no Supabase table): {", ".join(unknown)}', file=sys.stderr)


if __name__ == '__main__':
    main()
