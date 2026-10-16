#!/usr/bin/env bash
# Builds the whole database from the migrations on an EMPTY PostgreSQL
# database and runs the tests. Never point this at the real Supabase project.
#   DATABASE_URL=postgres://postgres@localhost:5432/test supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DATABASE_URL:?Set DATABASE_URL to an empty test database}"
psql() { command psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 "$@"; }

psql -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "Applying $f"
  psql -f "$f"
done
psql -f supabase/tests/rules_test.sql
