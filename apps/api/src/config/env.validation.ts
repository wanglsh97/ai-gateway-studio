import { z } from 'zod'

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  if (value.toLowerCase() === 'true') return true
  if (value.toLowerCase() === 'false') return false
  return value
}, z.boolean())

const optionalSecret = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
)

const optionalModelId = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
)

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL 必填'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    REDIS_URL: z.string().min(1, 'REDIS_URL 必填'),
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    MOCK_PROVIDER_ENABLED: booleanFromEnv.default(true),
    QWEN_ENABLED: booleanFromEnv.default(false),
    GLM_ENABLED: booleanFromEnv.default(false),
    DEEPSEEK_ENABLED: booleanFromEnv.default(false),
    WANXIANG_ENABLED: booleanFromEnv.default(false),
    COGVIEW_ENABLED: booleanFromEnv.default(false),
    QWEN_API_KEY: optionalSecret,
    QWEN_BASE_URL: z.string().url().default('https://dashscope.aliyuncs.com/compatible-mode/v1'),
    GLM_API_KEY: optionalSecret,
    GLM_BASE_URL: z.string().url().default('https://open.bigmodel.cn/api/paas/v4'),
    DEEPSEEK_API_KEY: optionalSecret,
    WANXIANG_API_KEY: optionalSecret,
    COGVIEW_API_KEY: optionalSecret,
    QWEN_MODEL_ID: optionalModelId,
    GLM_MODEL_ID: optionalModelId,
    DEEPSEEK_MODEL_ID: optionalModelId,
    WANXIANG_MODEL_ID: optionalModelId,
    COGVIEW_MODEL_ID: optionalModelId,
    PROMPT_OPTIMIZER_MODEL: z.enum(['qwen', 'glm', 'deepseek']).default('qwen'),
    CHAT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    IMAGE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(5),
    ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(5),
    CHAT_MAX_TOKENS: z.coerce.number().int().min(1).max(4096).default(4096),
  })
  .superRefine((env, context) => {
    const providers = [
      { name: 'QWEN', enabled: env.QWEN_ENABLED, key: env.QWEN_API_KEY, model: env.QWEN_MODEL_ID },
      { name: 'GLM', enabled: env.GLM_ENABLED, key: env.GLM_API_KEY, model: env.GLM_MODEL_ID },
      {
        name: 'DEEPSEEK',
        enabled: env.DEEPSEEK_ENABLED,
        key: env.DEEPSEEK_API_KEY,
        model: env.DEEPSEEK_MODEL_ID,
      },
      {
        name: 'WANXIANG',
        enabled: env.WANXIANG_ENABLED,
        key: env.WANXIANG_API_KEY,
        model: env.WANXIANG_MODEL_ID,
      },
      {
        name: 'COGVIEW',
        enabled: env.COGVIEW_ENABLED,
        key: env.COGVIEW_API_KEY,
        model: env.COGVIEW_MODEL_ID,
      },
    ]

    for (const provider of providers) {
      if (!provider.enabled) continue
      if (!provider.key) {
        context.addIssue({
          code: 'custom',
          path: [`${provider.name}_API_KEY`],
          message: `${provider.name} 启用时必须配置 API Key`,
        })
      }
      if (!provider.model) {
        context.addIssue({
          code: 'custom',
          path: [`${provider.name}_MODEL_ID`],
          message: `${provider.name} 启用时必须配置实际模型 ID`,
        })
      }
    }
  })

export type Environment = z.infer<typeof environmentSchema>

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(input)

  if (result.success) return result.data

  const reasons = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ')
  throw new Error(`环境变量校验失败：${reasons}`)
}
