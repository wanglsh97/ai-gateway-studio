ALTER TABLE "AgentRun"
ADD COLUMN "promptProfileVersion" VARCHAR(64),
ADD COLUMN "promptHash" VARCHAR(64),
ADD COLUMN "promptManifest" JSONB;
