-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'CANCELLING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'LIMIT_REACHED', 'INTERRUPTED');

-- CreateEnum
CREATE TYPE "AgentRunLimitReason" AS ENUM ('MODEL_CALLS', 'TOOL_CALLS', 'WEB_FETCH_CALLS', 'DURATION');

-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL');

-- CreateEnum
CREATE TYPE "AgentToolCallStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "RequestCapability" ADD VALUE 'AGENT';

-- AlterTable
ALTER TABLE "RequestLog" ADD COLUMN     "agentRunId" UUID;

-- CreateTable
CREATE TABLE "AgentThread" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "modelId" VARCHAR(128) NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgentThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "runId" UUID,
    "role" "AgentMessageRole" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "parts" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
    "limitReason" "AgentRunLimitReason",
    "input" TEXT NOT NULL,
    "errorCode" VARCHAR(64),
    "errorMessage" TEXT,
    "modelCallCount" INTEGER NOT NULL DEFAULT 0,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "webFetchCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "usageUnknown" BOOLEAN NOT NULL DEFAULT false,
    "estimatedCostCny" DECIMAL(18,8),
    "lastSequence" INTEGER NOT NULL DEFAULT -1,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentEvent" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToolCall" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "toolCallId" VARCHAR(191) NOT NULL,
    "toolName" VARCHAR(64) NOT NULL,
    "args" JSONB NOT NULL,
    "status" "AgentToolCallStatus" NOT NULL DEFAULT 'RUNNING',
    "summary" TEXT,
    "audit" JSONB,
    "errorCode" VARCHAR(64),
    "errorMessage" TEXT,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AgentToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentThread_userId_updatedAt_idx" ON "AgentThread"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AgentThread_userId_createdAt_idx" ON "AgentThread"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentMessage_threadId_createdAt_idx" ON "AgentMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentMessage_runId_idx" ON "AgentMessage"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMessage_threadId_sequence_key" ON "AgentMessage"("threadId", "sequence");

-- CreateIndex
CREATE INDEX "AgentRun_threadId_createdAt_idx" ON "AgentRun"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_userId_status_idx" ON "AgentRun"("userId", "status");

-- CreateIndex
CREATE INDEX "AgentEvent_runId_sequence_idx" ON "AgentEvent"("runId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "AgentEvent_runId_sequence_key" ON "AgentEvent"("runId", "sequence");

-- CreateIndex
CREATE INDEX "AgentToolCall_runId_idx" ON "AgentToolCall"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentToolCall_runId_toolCallId_key" ON "AgentToolCall"("runId", "toolCallId");

-- CreateIndex
CREATE INDEX "RequestLog_agentRunId_idx" ON "RequestLog"("agentRunId");

-- AddForeignKey
ALTER TABLE "RequestLog" ADD CONSTRAINT "RequestLog_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentThread" ADD CONSTRAINT "AgentThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AgentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AgentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
