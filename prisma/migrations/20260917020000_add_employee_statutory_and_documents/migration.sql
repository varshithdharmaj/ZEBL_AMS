-- CreateEnum
CREATE TYPE "EmployeeDocumentType" AS ENUM ('PAN_CARD', 'AADHAAR_CARD', 'PASSPORT', 'BANK_PROOF', 'OFFER_LETTER', 'EDUCATION_CERTIFICATE', 'RELIEVING_LETTER', 'OTHER');

-- CreateTable
CREATE TABLE "employee_statutory_details" (
    "employee_id" INTEGER NOT NULL,
    "pan_enc" TEXT,
    "aadhaar_enc" TEXT,
    "uan_enc" TEXT,
    "pf_number_enc" TEXT,
    "esi_number_enc" TEXT,
    "bank_account_no_enc" TEXT,
    "ifsc_enc" TEXT,
    "bank_name" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_statutory_details_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "document_type" "EmployeeDocumentType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "storage_key" TEXT NOT NULL,
    "checksum" TEXT,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_documents_employee_id_document_type_deleted_at_idx" ON "employee_documents"("employee_id", "document_type", "deleted_at");

-- AddForeignKey
ALTER TABLE "employee_statutory_details" ADD CONSTRAINT "employee_statutory_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_statutory_details" ADD CONSTRAINT "employee_statutory_details_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
