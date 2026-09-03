-- Run AFTER `prisma migrate deploy --schema=prisma-mysql/schema.prisma` (or
-- `prisma db push`) has created the offer_number_seq table.
--
-- Mirrors PostgreSQL's `CREATE SEQUENCE offer_number_seq START WITH 1000`
-- (see prisma/migrations/20260901100000_offer_lifecycle_cleanup/migration.sql).
-- Prisma's DSL has no way to set an initial AUTO_INCREMENT value, so it's set
-- here. Safe to re-run — ALTER TABLE ... AUTO_INCREMENT only raises the
-- counter, it's a no-op once real rows have pushed it past 1000.
ALTER TABLE `offer_number_seq` AUTO_INCREMENT = 1000;
