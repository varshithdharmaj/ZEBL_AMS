-- AlterTable
ALTER TABLE "recruitment_offers" ADD COLUMN     "decline_reason_code" TEXT,
ADD COLUMN     "negotiation_follow_up_at" TIMESTAMP(3),
ADD COLUMN     "negotiation_note" TEXT,
ADD COLUMN     "negotiation_status" TEXT,
ADD COLUMN     "negotiation_updated_at" TIMESTAMP(3);
