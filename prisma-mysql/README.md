# prisma-mysql — isolated MySQL schema

A MySQL 8+ mirror of `prisma/schema.prisma` (PostgreSQL, the app's primary
database — unaffected by anything in this directory) for alternative use
cases. Fully isolated: its own datasource, its own generated client output
(`src/generated/prisma-mysql`), its own `package.json` scripts
(`prisma:mysql:*`), never touched by `prisma generate`/`migrate`/`db push`
run without `--schema=prisma-mysql/schema.prisma`.

## Layout

- `schema.prisma` — generated from `prisma/schema.prisma` by
  `scripts/gen-mysql-schema.mjs`, plus hand-authored additions layered on top
  (see the file's header comment). Re-run the generator after editing the
  PostgreSQL schema, then **manually re-apply**:
  - `model OfferNumberSeq` (MySQL has no `CREATE SEQUENCE`)
  - `AttendanceSession.openAttendanceId` / `LeaveTransaction.systemAccrualKey`
    placeholder fields + `LeaveTransaction`'s `@@unique([leaveRequestId, transactionType])`
  - the comment on `Offer.offerNumber`
- `manual-migrations/` — raw SQL Prisma's DSL cannot express, run once after
  the Prisma-managed tables exist:
  - `0001_virtual_columns.sql` — converts the two placeholder columns above
    into real `GENERATED ALWAYS AS (...) VIRTUAL` columns + their unique
    indexes, replicating PostgreSQL's partial unique indexes
    (`attendance_sessions_one_open_per_day_idx`,
    `leave_transactions_system_accrual_reason_uidx`).
  - `0002_offer_number_seq.sql` — sets `offer_number_seq`'s starting
    `AUTO_INCREMENT` to 1000, matching Postgres's `START WITH 1000`.

## Commands

```
npm run prisma:mysql:validate   # schema syntax check (needs DATABASE_MYSQL_URL)
npm run prisma:mysql:generate   # generate the MySQL Prisma Client
npm run prisma:mysql:migrate    # dev migration (creates prisma-mysql/migrations)
npm run prisma:mysql:deploy     # deploy migrations (CI/prod)
```

After the first `migrate`/`deploy`, run the two files in `manual-migrations/`
in order against the same database (`mysql < manual-migrations/0001_...sql`,
then `0002_...sql`). They're idempotent — safe to re-run.

## Application-layer pieces (src/lib/)

- `db-driver.ts` — `getDbDriver()` reads `DB_DRIVER` (default `"postgresql"`,
  so leaving it unset changes nothing for the existing app).
- `db-lock.ts` — `withDbLock(tx, key, fn)`: `pg_advisory_xact_lock` under
  Postgres, `GET_LOCK`/`RELEASE_LOCK` under MySQL.
- `db-sequence.ts` — `nextOfferNumberSequenceValue(client)`: `nextval(...)`
  under Postgres, an insert into `OfferNumberSeq` + `LAST_INSERT_ID()` under
  MySQL.

`src/lib/db/queue-lock.ts`'s notification/integration-job claim queries were
also rewritten to drop PostgreSQL-only `UPDATE ... RETURNING` and
`::"EnumType"` casts in favor of `SELECT ... FOR UPDATE SKIP LOCKED` (inside
a transaction) + a typed `updateMany` — both supported by MySQL 8+ and
PostgreSQL. `src/lib/attendance/import/ensure-import-job-schema.ts`'s
Postgres-only self-healing DDL is now skipped entirely under
`DB_DRIVER=mysql`.
