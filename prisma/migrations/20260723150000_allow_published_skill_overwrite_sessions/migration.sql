DROP INDEX "SkillUploadSession_skillId_key";
DROP INDEX "SkillUploadSession_objectKey_key";

CREATE INDEX "SkillUploadSession_skillId_createdAt_idx"
ON "SkillUploadSession"("skillId", "createdAt");

CREATE INDEX "SkillUploadSession_objectKey_idx"
ON "SkillUploadSession"("objectKey");
