import { getDbDriver } from "@/lib/db-driver";

interface SequenceClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

/**
 * Returns the next value of the offer-number counter:
 *
 * - PostgreSQL: `SELECT nextval('offer_number_seq')` — the real CREATE
 *   SEQUENCE object (see prisma/migrations/20260901100000_offer_lifecycle_cleanup).
 * - MySQL: has no sequence object, so this inserts a throwaway row into the
 *   OfferNumberSeq counter table (prisma-mysql/schema.prisma) and reads back
 *   its AUTO_INCREMENT id via LAST_INSERT_ID() on the same connection. The
 *   starting offset (1000, matching Postgres START WITH 1000) is set once by
 *   prisma-mysql/manual-migrations/0002_offer_number_seq.sql, not here.
 *
 * Replaces the inline `SELECT nextval('offer_number_seq')` previously in
 * offer-service.ts's fetchNextOfferNumber().
 */
export async function nextOfferNumberSequenceValue(client: SequenceClient): Promise<number> {
  if (getDbDriver() === "mysql") {
    await client.$executeRawUnsafe("INSERT INTO `offer_number_seq` () VALUES ()");
    const rows = await client.$queryRaw<Array<{ id: bigint | number }>>`SELECT LAST_INSERT_ID() AS id`;
    const id = rows[0]?.id;
    if (id == null) throw new Error("[db-sequence] MySQL LAST_INSERT_ID() returned no row");
    return Number(id);
  }

  const rows = await client.$queryRaw<Array<{ nextval: bigint | number }>>`SELECT nextval('offer_number_seq')`;
  const nextVal = rows[0]?.nextval;
  if (nextVal == null) throw new Error("[db-sequence] PostgreSQL nextval('offer_number_seq') returned no row");
  return Number(nextVal);
}
