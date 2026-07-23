ALTER TABLE "SkillUploadSession"
ADD COLUMN "skillId" UUID;

CREATE UNIQUE INDEX "SkillUploadSession_skillId_key"
ON "SkillUploadSession"("skillId");

ALTER TABLE "SkillUploadSession"
ADD CONSTRAINT "SkillUploadSession_skillId_fkey"
FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "Skill"
SET "category" = CASE
  WHEN lower("category") IN ('development', '开发') THEN 'development'
  WHEN lower("category") IN ('data', '数据') THEN 'data'
  WHEN lower("category") IN ('research', '研究') THEN 'research'
  WHEN lower("category") IN ('content', '写作', '内容') THEN 'content'
  WHEN lower("category") IN ('productivity', '效率') THEN 'productivity'
  ELSE 'other'
END;

ALTER TABLE "Skill"
ADD CONSTRAINT "Skill_category_check"
CHECK ("category" IN (
  'development',
  'data',
  'research',
  'content',
  'productivity',
  'other'
));
