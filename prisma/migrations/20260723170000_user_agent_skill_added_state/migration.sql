DROP INDEX "UserAgentSkill_userId_enabled_idx";

ALTER TABLE "UserAgentSkill"
DROP COLUMN "enabled";

CREATE INDEX "UserAgentSkill_userId_createdAt_idx"
ON "UserAgentSkill"("userId", "createdAt");
