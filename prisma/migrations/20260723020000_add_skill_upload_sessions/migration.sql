CREATE TYPE "SkillUploadSessionStatus" AS ENUM (
    'PENDING_UPLOAD',
    'FINALIZED',
    'ABANDONED'
);
CREATE TYPE "ObjectCleanupStatus" AS ENUM ('NONE', 'PENDING', 'SUCCEEDED');

CREATE TABLE "SkillUploadSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "objectKey" VARCHAR(1024) NOT NULL,
    "status" "SkillUploadSessionStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "cleanupStatus" "ObjectCleanupStatus" NOT NULL DEFAULT 'NONE',
    "expectedContentType" VARCHAR(255) NOT NULL,
    "expectedSizeBytes" BIGINT NOT NULL,
    "expectedSha256" CHAR(64) NOT NULL,
    "observedSizeBytes" BIGINT,
    "observedSha256" CHAR(64),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "finalizedAt" TIMESTAMPTZ(3),
    "abandonedAt" TIMESTAMPTZ(3),
    "cleanupAttempts" INTEGER NOT NULL DEFAULT 0,
    "cleanupError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SkillUploadSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SkillUploadSession_expected_size_check"
      CHECK ("expectedSizeBytes" > 0 AND "expectedSizeBytes" <= 20971520),
    CONSTRAINT "SkillUploadSession_observed_size_check"
      CHECK ("observedSizeBytes" IS NULL OR "observedSizeBytes" >= 0),
    CONSTRAINT "SkillUploadSession_cleanup_attempts_check"
      CHECK ("cleanupAttempts" >= 0)
);

CREATE UNIQUE INDEX "SkillUploadSession_objectKey_key"
ON "SkillUploadSession"("objectKey");
CREATE INDEX "SkillUploadSession_userId_status_createdAt_idx"
ON "SkillUploadSession"("userId", "status", "createdAt");
CREATE INDEX "SkillUploadSession_status_expiresAt_idx"
ON "SkillUploadSession"("status", "expiresAt");
CREATE INDEX "SkillUploadSession_cleanupStatus_updatedAt_idx"
ON "SkillUploadSession"("cleanupStatus", "updatedAt");

ALTER TABLE "SkillUploadSession"
ADD CONSTRAINT "SkillUploadSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
