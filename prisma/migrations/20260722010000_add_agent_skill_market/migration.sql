CREATE TABLE "UserAgentSkill" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "skillId" VARCHAR(64) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserAgentSkill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAgentSkill_userId_skillId_key" ON "UserAgentSkill"("userId", "skillId");
CREATE INDEX "UserAgentSkill_userId_enabled_idx" ON "UserAgentSkill"("userId", "enabled");
CREATE INDEX "UserAgentSkill_skillId_idx" ON "UserAgentSkill"("skillId");

ALTER TABLE "UserAgentSkill"
ADD CONSTRAINT "UserAgentSkill_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
