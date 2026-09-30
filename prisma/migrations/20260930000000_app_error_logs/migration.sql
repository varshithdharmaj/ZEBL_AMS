-- CreateTable
CREATE TABLE "app_error_logs" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "error_name" TEXT,
    "stack" TEXT,
    "path" TEXT,
    "method" TEXT,
    "route_type" TEXT,
    "user_id" TEXT,
    "user_email" TEXT,
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_error_logs_ref_idx" ON "app_error_logs"("ref");

-- CreateIndex
CREATE INDEX "app_error_logs_created_at_idx" ON "app_error_logs"("created_at");
