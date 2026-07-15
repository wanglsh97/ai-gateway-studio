-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RequestCapability" AS ENUM ('CHAT', 'IMAGE', 'PROMPT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImageTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "RequestLog" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "capability" "RequestCapability" NOT NULL,
    "prompt" JSONB NOT NULL,
    "modelAlias" VARCHAR(64) NOT NULL,
    "provider" VARCHAR(64),
    "resolvedModel" VARCHAR(128),
    "providerRequestId" VARCHAR(191),
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "stream" BOOLEAN NOT NULL DEFAULT false,
    "clientIp" VARCHAR(64),
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstTokenAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "durationMs" INTEGER,
    "failoverFrom" VARCHAR(64),
    "failoverTo" VARCHAR(64),
    "failoverReason" VARCHAR(255),
    "errorCode" VARCHAR(64),
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRecord" (
    "id" UUID NOT NULL,
    "requestLogId" UUID NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "usageUnknown" BOOLEAN NOT NULL DEFAULT true,
    "priceVersion" VARCHAR(64),
    "inputCostCny" DECIMAL(18,8),
    "outputCostCny" DECIMAL(18,8),
    "estimatedCostCny" DECIMAL(18,8),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BillingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageGenerationTask" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "requestLogId" UUID NOT NULL,
    "providerTaskId" VARCHAR(191),
    "prompt" TEXT NOT NULL,
    "modelAlias" VARCHAR(64) NOT NULL,
    "provider" VARCHAR(64),
    "resolvedModel" VARCHAR(128),
    "options" JSONB,
    "status" "ImageTaskStatus" NOT NULL DEFAULT 'PENDING',
    "results" JSONB,
    "errorCode" VARCHAR(64),
    "errorMessage" TEXT,
    "lastPolledAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ImageGenerationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" UUID NOT NULL,
    "actor" VARCHAR(64) NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "targetTable" VARCHAR(64) NOT NULL,
    "targetId" VARCHAR(191) NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "requestId" UUID,
    "sourceIp" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequestLog_requestId_key" ON "RequestLog"("requestId");

-- CreateIndex
CREATE INDEX "RequestLog_createdAt_idx" ON "RequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_status_createdAt_idx" ON "RequestLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_modelAlias_createdAt_idx" ON "RequestLog"("modelAlias", "createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_capability_createdAt_idx" ON "RequestLog"("capability", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_requestLogId_key" ON "BillingRecord"("requestLogId");

-- CreateIndex
CREATE INDEX "BillingRecord_createdAt_idx" ON "BillingRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImageGenerationTask_taskId_key" ON "ImageGenerationTask"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageGenerationTask_requestLogId_key" ON "ImageGenerationTask"("requestLogId");

-- CreateIndex
CREATE INDEX "ImageGenerationTask_status_createdAt_idx" ON "ImageGenerationTask"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ImageGenerationTask_createdAt_idx" ON "ImageGenerationTask"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImageGenerationTask_provider_providerTaskId_key" ON "ImageGenerationTask"("provider", "providerTaskId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetTable_createdAt_idx" ON "AdminAuditLog"("targetTable", "createdAt");

-- AddForeignKey
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_requestLogId_fkey" FOREIGN KEY ("requestLogId") REFERENCES "RequestLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageGenerationTask" ADD CONSTRAINT "ImageGenerationTask_requestLogId_fkey" FOREIGN KEY ("requestLogId") REFERENCES "RequestLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
