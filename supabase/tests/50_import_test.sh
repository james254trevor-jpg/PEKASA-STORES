#!/bin/bash
# Imports a small sample browser backup into a scratch database; needs PG* env vars and python3.
# Checks: rows arrive, quotes survive, password columns are NOT copied, running twice is harmless.
set -euo pipefail
cd "$(dirname "$0")/../.."
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
psql -q -c "drop database if exists imp_test" -c "create database imp_test" postgres
Q="psql -q -v ON_ERROR_STOP=1 -d imp_test"
$Q -f supabase/tests/00_supabase_shim.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do $Q -f "$f" >/dev/null 2>&1; done
python3 -I - "$W/b.sqlite" <<'PY'
import sqlite3, sys
d = sqlite3.connect(sys.argv[1])
d.executescript("""
create table user_roles(id text primary key,name text,permissions_json text,description text);
create table users(id text primary key,username text,full_name text,email text,phone text,role_id text,role_title text,is_active integer,created_at text,last_login text,password_hash text,password_salt text);
create table customers(id text primary key,customer_number text,name text,id_number text,phone text,alt_phone text,address text,county text,photo_url text,id_photo_url text,status text,notes text,defaults_count integer,created_at text,updated_at text);
create table sequence_counters(prefix text primary key,current_year integer,last_sequence integer);
insert into user_roles values('role-admin','Administrator','{}','d');
insert into users values('usr-t','trevor','Trevor','t@x.co','0711111111','role-admin','Administrator',1,'2026-01-01',null,'SECRETHASH','SECRETSALT');
insert into customers values('cus-1','CUS-2026-000001','O''Brien','12345678','0722000000','','N','N',null,null,'ACTIVE','has ''quote''',0,'2026-02-01','2026-02-01');
insert into customers values('cus-2','CUS-2026-000002','Second','87654321','0733000000','','x','y',null,null,'ACTIVE','',0,'2026-02-02','2026-02-02');
insert into sequence_counters values('CUS',2026,2);
""")
d.commit()
PY
python3 -I supabase/import/sqlite_to_sql.py "$W/b.sqlite" --branch br-nairobi > "$W/i.sql" 2>/dev/null
! grep -q "SECRETHASH\|SECRETSALT" "$W/i.sql" || { echo "FAIL: password data in import"; exit 1; }
$Q -c "insert into public.branches(id,code,name,city,address,phone,is_main) values('br-nairobi','NBO','Nairobi','Nairobi','a','p',1)"
$Q -f "$W/i.sql" >/dev/null; $Q -f "$W/i.sql" >/dev/null
r=$($Q -tA -c "select (select count(*) from public.customers)||'|'||(select string_agg(distinct branch_id,',') from public.customers)||'|'||(select notes from public.customers where id='cus-1')||'|'||(select last_sequence from public.sequence_counters where prefix='CUS')")
[ "$r" = "2|br-nairobi|has 'quote'|2" ] || { echo "FAIL: got $r"; exit 1; }
psql -q -c "drop database imp_test" postgres
echo "import test: ALL CHECKS PASSED"
