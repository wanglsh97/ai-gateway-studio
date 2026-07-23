-- Extend Agent terminal limits for sandbox execution.
ALTER TYPE "AgentRunLimitReason" ADD VALUE 'SANDBOX_DURATION';
ALTER TYPE "AgentRunLimitReason" ADD VALUE 'SHELL_CALLS';
ALTER TYPE "AgentRunLimitReason" ADD VALUE 'SANDBOX_OUTPUT';
ALTER TYPE "AgentRunLimitReason" ADD VALUE 'SANDBOX_EGRESS';
ALTER TYPE "AgentRunLimitReason" ADD VALUE 'SANDBOX_RESOURCE';

CREATE TYPE "SkillStatus" AS ENUM ('PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'DELISTED');
CREATE TYPE "SkillReviewDecision" AS ENUM ('APPROVED', 'REJECTED');
CREATE TYPE "UserFileDirection" AS ENUM ('INPUT', 'OUTPUT');
CREATE TYPE "UserFileStatus" AS ENUM (
    'PENDING_UPLOAD',
    'AVAILABLE',
    'DELETING',
    'CLEANUP_PENDING',
    'DELETED'
);

-- `marketSkillId` is nullable during the prompt-only Skill compatibility period.
-- A later data migration backfills it before removing the legacy slug and enabled fields.
ALTER TABLE "UserAgentSkill" ADD COLUMN "marketSkillId" UUID;

ALTER TABLE "AgentRun"
ADD COLUMN "shellCallCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sandboxId" VARCHAR(191),
ADD COLUMN "activeSkillManifest" JSONB,
ADD COLUMN "fileManifest" JSONB,
ADD COLUMN "sandboxUsage" JSONB,
ADD COLUMN "sandboxStartedAt" TIMESTAMPTZ(3),
ADD COLUMN "sandboxDestroyedAt" TIMESTAMPTZ(3);

ALTER TABLE "AgentToolCall"
ADD COLUMN "sandboxId" VARCHAR(191),
ADD COLUMN "skillId" UUID,
ADD COLUMN "skillName" VARCHAR(64),
ADD COLUMN "packageSha256" CHAR(64),
ADD COLUMN "command" TEXT,
ADD COLUMN "workingDirectory" TEXT,
ADD COLUMN "exitCode" INTEGER,
ADD COLUMN "durationMs" INTEGER,
ADD COLUMN "stdoutBytes" INTEGER,
ADD COLUMN "stderrBytes" INTEGER,
ADD COLUMN "stdoutTruncated" BOOLEAN,
ADD COLUMN "stderrTruncated" BOOLEAN,
ADD COLUMN "sandboxLimitReason" VARCHAR(64);

CREATE TABLE "Skill" (
    "id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(400) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "status" "SkillStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "iconObjectKey" VARCHAR(1024),
    "packageObjectKey" VARCHAR(1024),
    "packageSha256" CHAR(64),
    "packageSizeBytes" BIGINT,
    "skillMarkdown" TEXT,
    "fileTree" JSONB,
    "addCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMPTZ(3),
    "delistedAt" TIMESTAMPTZ(3),
    "packageUpdatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Skill_name_format_check"
      CHECK ("name" ~ '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$'),
    CONSTRAINT "Skill_add_count_check" CHECK ("addCount" >= 0),
    CONSTRAINT "Skill_package_size_check"
      CHECK ("packageSizeBytes" IS NULL OR "packageSizeBytes" >= 0)
);

CREATE TABLE "SkillReview" (
    "id" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "reviewer" VARCHAR(64) NOT NULL,
    "decision" "SkillReviewDecision" NOT NULL,
    "reason" TEXT,
    "packageSha256" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserFile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "runId" UUID,
    "sourceToolCallId" UUID,
    "direction" "UserFileDirection" NOT NULL,
    "status" "UserFileStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "name" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(255),
    "objectKey" VARCHAR(1024) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" CHAR(64),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserFile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserFile_size_check" CHECK ("sizeBytes" >= 0)
);

CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");
CREATE UNIQUE INDEX "Skill_packageObjectKey_key" ON "Skill"("packageObjectKey");
CREATE INDEX "Skill_status_publishedAt_idx" ON "Skill"("status", "publishedAt");
CREATE INDEX "Skill_category_status_idx" ON "Skill"("category", "status");
CREATE INDEX "Skill_ownerId_updatedAt_idx" ON "Skill"("ownerId", "updatedAt");
CREATE INDEX "Skill_addCount_idx" ON "Skill"("addCount");

CREATE INDEX "SkillReview_skillId_createdAt_idx" ON "SkillReview"("skillId", "createdAt");
CREATE INDEX "SkillReview_reviewer_createdAt_idx" ON "SkillReview"("reviewer", "createdAt");

CREATE UNIQUE INDEX "UserFile_objectKey_key" ON "UserFile"("objectKey");
CREATE INDEX "UserFile_userId_status_createdAt_idx" ON "UserFile"("userId", "status", "createdAt");
CREATE INDEX "UserFile_runId_idx" ON "UserFile"("runId");
CREATE INDEX "UserFile_sourceToolCallId_idx" ON "UserFile"("sourceToolCallId");

CREATE UNIQUE INDEX "UserAgentSkill_userId_marketSkillId_key"
ON "UserAgentSkill"("userId", "marketSkillId");
CREATE INDEX "UserAgentSkill_marketSkillId_idx" ON "UserAgentSkill"("marketSkillId");

CREATE UNIQUE INDEX "AgentRun_sandboxId_key" ON "AgentRun"("sandboxId");
CREATE INDEX "AgentToolCall_skillId_idx" ON "AgentToolCall"("skillId");
CREATE INDEX "AgentToolCall_sandboxId_idx" ON "AgentToolCall"("sandboxId");

ALTER TABLE "Skill"
ADD CONSTRAINT "Skill_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SkillReview"
ADD CONSTRAINT "SkillReview_skillId_fkey"
FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserAgentSkill"
ADD CONSTRAINT "UserAgentSkill_marketSkillId_fkey"
FOREIGN KEY ("marketSkillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AgentToolCall"
ADD CONSTRAINT "AgentToolCall_skillId_fkey"
FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserFile"
ADD CONSTRAINT "UserFile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserFile"
ADD CONSTRAINT "UserFile_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserFile"
ADD CONSTRAINT "UserFile_sourceToolCallId_fkey"
FOREIGN KEY ("sourceToolCallId") REFERENCES "AgentToolCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentRun"
ADD CONSTRAINT "AgentRun_shell_call_count_check" CHECK ("shellCallCount" >= 0);

ALTER TABLE "AgentToolCall"
ADD CONSTRAINT "AgentToolCall_duration_check"
CHECK ("durationMs" IS NULL OR "durationMs" >= 0);

ALTER TABLE "AgentToolCall"
ADD CONSTRAINT "AgentToolCall_stdout_bytes_check"
CHECK ("stdoutBytes" IS NULL OR "stdoutBytes" >= 0);

ALTER TABLE "AgentToolCall"
ADD CONSTRAINT "AgentToolCall_stderr_bytes_check"
CHECK ("stderrBytes" IS NULL OR "stderrBytes" >= 0);
