---
title: '매치다 안전하게 만들기 ③: 마이그레이션 15개를 하나의 schema.sql로 합치고 검증하기'
date: '2026-07-07'
publish_date: '2026-08-21'
description: Supabase 마이그레이션 파일이 파편화된 상태를 단일 스키마 파일로 통합하고, PostgREST API로 실제 운영 DB와 컬럼 단위 자동 대조 검증까지 진행한 기록
tags:
  - Supabase
  - PostgreSQL
  - DB백업
  - 스키마관리
  - Python
---

## 왜 이 작업이 필요했나

매치다는 기능을 하나씩 추가할 때마다 `supabase/migrations/001_xxx.sql`, `002_xxx.sql` 식으로 마이그레이션 파일을 쌓아왔습니다. 이 방식 자체는 정상입니다 — DB 변경 이력을 순서대로 남기는 표준적인 방법이죠. 문제는 이렇습니다.

- 마이그레이션이 **15개**까지 쌓이자, "지금 우리 DB가 정확히 어떤 모양인지"를 파악하려면 파일 15개를 순서대로 읽으며 머릿속으로 합쳐야 했습니다.
- 새 환경(테스트용 DB, 재해복구 시나리오)을 만들려면 이 15개를 순서대로 다시 실행해야 하는데, 그중 일부(`002_seed_*`, `006_migrate_*`)는 스키마가 아니라 **특정 계정을 위한 일회성 데이터 작업**이라 그대로 재실행하면 안 되는 것들이었습니다.
- 그리고 무엇보다, **"이 마이그레이션 파일들을 다 합치면 정말 지금 운영 DB와 똑같은가?"**를 아무도 검증한 적이 없었습니다.

그래서 이번 작업은 두 가지였습니다. ① 마이그레이션들을 최종 상태 하나로 통합한 `schema.sql`을 만들고, ② 그게 진짜 운영 DB와 일치하는지 자동으로 대조하는 것.

## Step 1. 마이그레이션 전체를 읽고 최종 상태 추론하기

15개 파일을 하나씩 읽으면서 각 테이블의 최종 컬럼 목록을 정리했습니다. 예를 들어 `matches` 테이블 하나만 해도 이런 식으로 여러 마이그레이션에 걸쳐 컬럼이 추가돼 있었습니다.

```sql
-- 001: memo 컬럼 추가
-- 005: applied_resume_text, applied_resume_filename 추가
-- 007: applied_at 추가
-- 012: position 추가
-- 014: optimization 추가
```

이걸 다 모아서 하나의 `CREATE TABLE`로 재구성합니다.

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

이 과정에서 드리프트(설계 의도와 실제 구현의 불일치)를 하나 발견했습니다. 시드 스크립트들이 `INSERT ... ON CONFLICT (email) DO NOTHING`을 쓰고, 앱 코드의 `getOrCreateProfile`도 이메일로 프로필을 단일 조회하는데, 정작 **`profiles.email`에 UNIQUE 제약을 거는 마이그레이션이 없었습니다.** 이런 건 각 마이그레이션을 따로 볼 때는 절대 안 보이고, 전체를 한 파일로 합치려고 시도할 때만 드러납니다.

```sql
-- 통합하면서 추가한 제약
email TEXT UNIQUE,  -- getOrCreateProfile 이 email 로 단일 조회하므로
```

## Step 2. 멱등성(idempotent) 있게 작성하기

`schema.sql` 하나로 빈 프로젝트에도, 이미 일부 적용된 프로젝트에도 안전하게 실행할 수 있어야 합니다. 그래서 전부 `IF NOT EXISTS` / `DROP ... IF EXISTS` 패턴으로 작성했습니다.

```sql
CREATE TABLE IF NOT EXISTS tailored_resumes (...);

DROP POLICY IF EXISTS "tailored_resumes: 본인만 조회" ON tailored_resumes;
CREATE POLICY "tailored_resumes: 본인만 조회" ON tailored_resumes
  FOR SELECT USING (auth.uid() = user_id);
```

RLS 정책은 `CREATE POLICY IF NOT EXISTS` 문법이 없어서, `DROP POLICY IF EXISTS` 후 `CREATE POLICY`로 재생성하는 방식을 썼습니다. 재실행해도 에러 없이 최신 정책으로 덮어써집니다.

## Step 3. 진짜 운영 DB와 일치하는지 검증하기

여기가 이번 작업에서 가장 중요한 부분입니다. `schema.sql`을 아무리 정성껏 만들어도, 사람이 손으로 대조한 건 결국 사람 실수가 낄 수 있습니다. 그래서 **기계적으로 검증**하기로 했습니다.

문제는 `psql`이나 Supabase CLI가 로컬에 설치돼 있지 않았다는 것. 이럴 때 의외로 유용한 게 **PostgREST의 OpenAPI 스펙**입니다. Supabase의 REST API 엔드포인트(`/rest/v1/`)에 GET 요청을 보내면, 현재 DB의 모든 테이블·컬럼 정보가 담긴 OpenAPI(Swagger) 문서를 돌려줍니다.

```bash
curl -s "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  > openapi.json
```

이 JSON의 `definitions` 필드 안에 테이블별 컬럼 목록이 그대로 들어 있습니다. 이걸 `schema.sql`을 파싱한 결과와 비교하는 짧은 Python 스크립트를 짰습니다.

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
        print(f"[DIFF] {t}: 라이브에만={only_live} / schema.sql에만={only_sql}")
    else:
        print(f"[OK] {t} ({len(tables[t])} 컬럼 일치)")
```

실행 결과, 7개 테이블 전부 컬럼 단위로 완전히 일치한다는 걸 확인했습니다.

```
[OK] profiles  (24 컬럼 일치)
[OK] jobs  (10 컬럼 일치)
[OK] matches  (14 컬럼 일치)
[OK] cover_letters  (7 컬럼 일치)
[OK] tailored_resumes  (7 컬럼 일치)
[OK] job_sources  (8 컬럼 일치)
[OK] discovered_jobs  (11 컬럼 일치)
```

`psql`이나 전용 CLI가 없어도, **서비스가 이미 쓰고 있는 API 하나로 스키마 검증을 자동화할 수 있다**는 게 이번 작업의 소소한 발견이었습니다.

## Step 4. 백업·복구 절차 문서화

스키마를 정리한 김에, `supabase/README.md`에 백업 전략을 정리했습니다. 핵심 원칙은 세 가지입니다.

1. **스키마 백업 = `schema.sql` 커밋.** 스키마를 바꾸면 운영 DB에 적용 → `schema.sql` 갱신 → 커밋, 이 순서를 지켜서 코드와 실제 상태가 항상 같이 움직이게 합니다.
2. **데이터 백업 = 정기 `pg_dump`.**
   ```bash
   # 전체(스키마+데이터) 논리 백업
   pg_dump "$DATABASE_URL" --no-owner --no-privileges -Fc -f backup_$(date +%Y%m%d).dump

   # 복구
   pg_restore --no-owner --no-privileges -d "$DATABASE_URL" backup_20260707.dump
   ```
3. **`.gitignore`에 덤프 파일 차단 추가.** 백업 파일에는 유저 개인정보가 그대로 들어있으니, 실수로 커밋되지 않게 미리 막아둡니다.

```gitignore
# db backups / dumps (개인정보 포함 — 절대 커밋 금지)
*.dump
backup_*.sql
data_*.sql
```

## 자주 쓰는 패턴 요약

| 목적 | 명령어/방법 |
|---|---|
| 운영 DB 구조를 API로 확인 | `curl $SUPABASE_URL/rest/v1/` (OpenAPI 스펙 반환) |
| 새 프로젝트에 스키마 적용 | `psql $DATABASE_URL -f schema.sql` |
| 전체 데이터 백업 | `pg_dump $DATABASE_URL -Fc -f backup.dump` |
| 데이터 복구 | `pg_restore -d $DATABASE_URL backup.dump` |
| RLS 정책 안전하게 재정의 | `DROP POLICY IF EXISTS ...` 후 `CREATE POLICY` |

## 트러블슈팅

**Q. `psql: command not found`인데 DB 상태를 확인하고 싶다**
A. Supabase(또는 PostgREST를 쓰는 다른 백엔드)라면 REST 엔드포인트의 OpenAPI 스펙으로 우회할 수 있습니다. `service_role` 키가 필요하니 서버 환경에서만 실행하세요.

**Q. 마이그레이션 폴더는 이제 필요 없나?**
A. 아닙니다. `migrations/`는 "어떻게 여기까지 왔는가"라는 이력이고, `schema.sql`은 "지금 무엇인가"라는 스냅샷입니다. 둘의 역할이 다르므로 계속 함께 관리합니다. 앞으로 스키마를 바꿀 때도 새 마이그레이션 파일을 추가하면서 `schema.sql`을 동시에 갱신하는 규칙을 세웠습니다.

## 정리

```
마이그레이션 15개 정독 → 최종 컬럼 상태로 재구성 → 멱등하게 작성(IF NOT EXISTS)
  → PostgREST OpenAPI로 운영 DB 스펙 획득 → Python으로 컬럼 단위 자동 대조
  → 백업/복구 절차 문서화 → .gitignore로 덤프 차단
```

가장 크게 느낀 건, **"통합했다"는 주장과 "통합한 게 맞다"는 검증은 다른 작업**이라는 점입니다. 손으로 여러 파일을 합치는 작업일수록, 마지막에 기계적으로 대조하는 단계를 반드시 넣어야 안심할 수 있었습니다.

다음 편에서는 이렇게 정리한 스키마에 실제로 새 기능(컬럼 2개)을 추가한 이야기 — 공개 이력서 공유 링크 기능을 다룹니다.
