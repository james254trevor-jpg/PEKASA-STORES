#!/usr/bin/env bash
# Many simultaneous requests for numbers must never hand out the same number twice.
# Needs the usual PG* environment variables (PGHOST, PGPORT, PGUSER, PGDATABASE) pointing at a
# database where the shim, all migrations and the staff fixtures of 20_sequences_and_otp_test.sql exist.
set -euo pipefail
WORKERS=${WORKERS:-40}; PER_WORKER=${PER_WORKER:-5}; TOTAL=$((WORKERS * PER_WORKER))

psql -qAt -c "delete from public.sequence_counters where prefix = 'TXN'" >/dev/null
out=$(mktemp); trap 'rm -f "$out"' EXIT

worker() {
  for _ in $(seq "$PER_WORKER"); do
    psql -qAt -c "set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1'; set role authenticated; select public.next_sequence('TXN');" | tail -1
  done
}
export -f worker; export PER_WORKER
seq "$WORKERS" | xargs -P "$WORKERS" -I{} bash -c 'worker' > "$out"

got=$(wc -l < "$out"); uniq=$(sort -n "$out" | uniq | wc -l); max=$(sort -n "$out" | tail -1); min=$(sort -n "$out" | head -1)
echo "requested $TOTAL numbers from $WORKERS parallel sessions: got $got, unique $uniq, range $min..$max"
[ "$got" -eq "$TOTAL" ] && [ "$uniq" -eq "$TOTAL" ] && [ "$min" -eq 1 ] && [ "$max" -eq "$TOTAL" ] \
  && echo "PASS: no duplicates, no gaps" || { echo "FAIL"; exit 1; }
