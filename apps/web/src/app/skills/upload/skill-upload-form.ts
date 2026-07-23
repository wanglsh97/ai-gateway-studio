export const SKILL_CATEGORIES = [
  { value: 'development', label: '开发工具' },
  { value: 'data', label: '数据处理' },
  { value: 'research', label: '研究分析' },
  { value: 'content', label: '内容创作' },
  { value: 'productivity', label: '效率自动化' },
  { value: 'other', label: '其他' },
] as const

export type SkillCategory = (typeof SKILL_CATEGORIES)[number]['value']

export const MAX_SKILL_ICON_BYTES = 2 * 1024 * 1024
export const MAX_SKILL_PACKAGE_BYTES = 20 * 1024 * 1024
export const SKILL_TITLE_MAX_LENGTH = 60
export const SKILL_DESCRIPTION_MAX_LENGTH = 240

interface FileMetadata {
  name: string
  size: number
  type: string
}

export function validateSkillPackageFile(file: FileMetadata): string | null {
  if (!file.name.toLowerCase().endsWith('.zip')) return '请选择 .zip 格式的 Skill 资源包'
  if (file.size < 1) return 'Skill 资源包不能为空'
  if (file.size > MAX_SKILL_PACKAGE_BYTES) return 'Skill 资源包不能超过 20 MiB'
  return null
}

export function validateSkillIconFile(file: FileMetadata): string | null {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return '图标仅支持 PNG、JPEG 或 WebP'
  }
  if (file.size < 1 || file.size > MAX_SKILL_ICON_BYTES) return '图标大小须在 2 MiB 以内'
  return null
}

export function validateSkillMetadata(input: {
  name: string
  title: string
  description: string
  category: string
}): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(input.name)) {
    errors.name = '名称须为 1–64 位小写字母、数字或连字符'
  }
  const title = input.title.trim()
  if (!title || title.length > SKILL_TITLE_MAX_LENGTH) {
    errors.title = `标题须为 1–${SKILL_TITLE_MAX_LENGTH} 个字符`
  }
  const description = input.description.trim()
  if (!description || description.length > SKILL_DESCRIPTION_MAX_LENGTH) {
    errors.description = `简介须为 1–${SKILL_DESCRIPTION_MAX_LENGTH} 个字符`
  }
  if (!SKILL_CATEGORIES.some((category) => category.value === input.category)) {
    errors.category = '请选择平台分类'
  }
  return errors
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}
