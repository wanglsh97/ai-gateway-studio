ALTER TYPE "AgentRunLimitReason" ADD VALUE 'CONTEXT_WINDOW';

CREATE TABLE "AgentContextSummary" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "coveredThroughSequence" INTEGER NOT NULL,
    "schemaVersion" VARCHAR(32) NOT NULL,
    "promptHash" VARCHAR(64) NOT NULL,
    "modelId" VARCHAR(128) NOT NULL,
    "content" JSONB NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgentContextSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentContextSummary_threadId_key" ON "AgentContextSummary"("threadId");
CREATE INDEX "AgentContextSummary_updatedAt_idx" ON "AgentContextSummary"("updatedAt");

ALTER TABLE "AgentContextSummary" ADD CONSTRAINT "AgentContextSummary_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "AgentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
