---
title: 'Hardening MatchDa (3): Merging 15 Migrations Into One schema.sql and Verifying It'
date: '2026-07-07'
publish_date: '2026-08-21'
description: Consolidating a fragmented set of Supabase migration files into a single schema file, and automatically cross-checking it column-by-column against the actual production DB via the PostgREST API
tags:
  - Supabase
  - PostgreSQL
  - DB Backup
  - Schema Management
  - Python
---

## Why this work was needed

Every time MatchDa added a feature, it piled up migration files like `supabase/migrations/001_xxx.sql`, `002_xxx.sql`. This approach itself is fine — it's the standard way to leave a sequential record of DB changes. Here's the problem.

- Once migrations piled up to **15,** figuring out "what shape our DB is exactly in right now" meant reading all 15 files in order and merging them in your head.
- Setting up a new environment (a test DB, a disaster-recovery scenario) requires re-running these 15 in order, but some of them (`002_seed_*`, `006_migrate_*`) weren't schema changes at all — they were **one-off data operations for specific accounts** that shouldn't just get re-run as-is.
- And above all, **nobody had ever verified whether "merging all these migration files together" actually matches the current production DB.**

So this work had two parts. ① Building a `schema.sql` that consolidates the migrations into a single final state, and ② automatically cross-checking whether that actually matches the real production DB.

## Step 1. Reading through every migration to infer the final state

I read through all 15 files one by one and organized each table's final column list. Just the `matches` table alone, for example, had columns added across multiple migrations like this.

```sql
-- 001: added the memo column
-- 005: added applied_resume_text, applied_resume_filename
-- 007: added applied_at
-- 012: added position
-- 014: added optimization
```

I gathered all of this and reconstructed it into a single `CREATE TABLE`.

```sql
CREATE TABLE IF NOT EXISTS matches (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id                  UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  score                   INTEGER CHECK (score >= 0 AND score <= 100),
  reason                  TEXT,
  highlights              TEXT[],
  status                  TEXT NOT NULL DEFAULT 'new',
  memo                    TEXT,
  position                INTEGER,
  applied_at              TIMESTAMPTZ,
  applied_resume_text     TEXT,
  applied_resume_filename TEXT,
  optimization            JSONB,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, job_id)
);
```

In this process, I found one instance of drift (a mismatch between design intent and actual implementation). The seed scripts use `INSERT ... ON CONFLICT (email) DO NOTHING`, and the app code's `getOrCreateProfile` also does a single lookup of a profile by email — but there was actually **no migration putting a UNIQUE constraint on `profiles.email`.** This is the kind of thing that's never visible when looking at each migration separately, and only surfaces when you actually try to merge everything into one file.

```sql
-- constraint added during consolidation
email TEXT UNIQUE,  -- since getOrCreateProfile does a single lookup by email
```

## Step 2. Writing it to be idempotent

A single `schema.sql` needs to run safely both on an empty project and on one where some of it is already applied. So I wrote everything using the `IF NOT EXISTS` / `DROP ... IF EXISTS` pattern.

```sql
CREATE TABLE IF NOT EXISTS tailored_resumes (...);

DROP POLICY IF EXISTS "tailored_resumes: view own only" ON tailored_resumes;
CREATE POLICY "tailored_resumes: view own only" ON tailored_resumes
  FOR SELECT USING (auth.uid() = user_id);
```

Since there's no `CREATE POLICY IF NOT EXISTS` syntax for RLS policies, I used the approach of `DROP POLICY IF EXISTS` followed by `CREATE POLICY` to recreate it. Even re-running it overwrites with the latest policy with no error.

## Step 3. Verifying it matches the actual production DB

This is the most important part of this work. No matter how carefully `schema.sql` gets built, a human cross-checking it by hand can still let a human mistake slip in. So I decided to **verify it mechanically.**

The problem was that neither `psql` nor the Supabase CLI were installed locally. Surprisingly useful here is **PostgREST's OpenAPI spec.** Sending a GET request to Supabase's REST API endpoint (`/rest/v1/`) returns an OpenAPI (Swagger) document containing every table and column in the current DB.

```bash
curl -s "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  > openapi.json
```

This JSON's `definitions` field contains each table's column list directly. I wrote a short Python script to compare this against the result of parsing `schema.sql`.

```python
import json, re

spec = json.load(open("openapi.json"))
live = {t: set(p.get("properties", {}).keys())
        for t, p in spec.get("definitions", {}).items()}

sql = open("schema.sql").read()
tables = {}
for m in re.finditer(r"CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\((.*?)\n\);", sql, re.S):
    name, body = m.group(1), m.group(2)
    cols = set()
    for line in body.split("\n"):
        line = line.strip().rstrip(",")
        first = line.split()[0] if line and not line.startswith("--") else ""
        if first and first.upper() not in ("UNIQUE", "PRIMARY", "FOREIGN", "CONSTRAINT", "CHECK"):
            if re.match(r"^[a-z_][a-z0-9_]*$", first):
                cols.add(first)
    tables[name] = cols

for t in tables:
    only_live = live.get(t, set()) - tables[t]
    only_sql  = tables[t] - live.get(t, set())
    if only_live or only_sql:
        print(f"[DIFF] {t}: live-only={only_live} / schema.sql-only={only_sql}")
    else:
        print(f"[OK] {t} ({len(tables[t])} columns match)")
```

Running it confirmed all 7 tables matched completely, column by column.

```
[OK] profiles  (24 columns match)
[OK] jobs  (10 columns match)
[OK] matches  (14 columns match)
[OK] cover_letters  (7 columns match)
[OK] tailored_resumes  (7 columns match)
[OK] job_sources  (8 columns match)
[OK] discovered_jobs  (11 columns match)
```

Even without `psql` or a dedicated CLI, **schema verification can be automated with a single API the service is already using** — a small discovery from this task.

## Step 4. Documenting backup and restore procedures

While I was cleaning up the schema, I also wrote up a backup strategy in `supabase/README.md`. The core principles are three.

1. **Schema backup = committing `schema.sql`.** When the schema changes: apply it to the production DB → update `schema.sql` → commit, in that order, keeping the code and the actual state always moving together.
2. **Data backup = regular `pg_dump`.**
   ```bash
   # a full (schema + data) logical backup
   pg_dump "$DATABASE_URL" --no-owner --no-privileges -Fc -f backup_$(date +%Y%m%d).dump

   # restore
   pg_restore --no-owner --no-privileges -d "$DATABASE_URL" backup_20260707.dump
   ```
3. **Blocking dump files in `.gitignore`.** Backup files contain user personal data as-is, so I blocked them from ever being accidentally committed.

```gitignore
# db backups / dumps (contain personal data — never commit)
*.dump
backup_*.sql
data_*.sql
```

## Common patterns, summarized

| Purpose | Command/approach |
|---|---|
| Checking production DB structure via API | `curl $SUPABASE_URL/rest/v1/` (returns the OpenAPI spec) |
| Applying a schema to a new project | `psql $DATABASE_URL -f schema.sql` |
| Backing up all data | `pg_dump $DATABASE_URL -Fc -f backup.dump` |
| Restoring data | `pg_restore -d $DATABASE_URL backup.dump` |
| Safely redefining an RLS policy | `DROP POLICY IF EXISTS ...` then `CREATE POLICY` |

## Troubleshooting

**Q. `psql: command not found`, but I want to check the DB's state**
A. On Supabase (or any other backend using PostgREST), you can work around this with the REST endpoint's OpenAPI spec. It needs the `service_role` key, so only run this in a server environment.

**Q. Is the migrations folder unnecessary now?**
A. No. `migrations/` is the history of "how we got here," and `schema.sql` is a snapshot of "what it is right now." The two serve different roles, so both keep being maintained together. Going forward, whenever the schema changes, the rule is to add a new migration file while updating `schema.sql` at the same time.

## Summary

```
Read all 15 migrations thoroughly → reconstruct the final column state → write it idempotently (IF NOT EXISTS)
  → get the production DB's spec via PostgREST's OpenAPI → auto cross-check column-by-column with Python
  → document backup/restore procedures → block dumps via .gitignore
```

The biggest realization was that **the claim "it's consolidated" and the verification "it's correctly consolidated" are different tasks.** The more manual the work of merging multiple files by hand, the more essential it was to add a mechanical cross-checking step at the end, before I could actually feel at ease.

Next up: the story of actually adding a new feature (2 columns) to this newly cleaned-up schema — a public resume-sharing link feature.
