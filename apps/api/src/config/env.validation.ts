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

const adminSessionSecret = z.preprocess(
  (value) =>
    value === undefined || value === '' ? 'development-only-admin-session-secret-change-me' : value,
  z.string().min(32),
)

const optionalModelId = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
)

const optionalTextModelAlias = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.enum(['qwen', 'glm', 'deepseek', 'kimi']).optional(),
)

const optionalNonNegativeDecimal = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .regex(/^\d+(?:\.\d+)?$/)
    .optional(),
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
    KIMI_ENABLED: booleanFromEnv.default(false),
    WANXIANG_ENABLED: booleanFromEnv.default(false),
    COGVIEW_ENABLED: booleanFromEnv.default(false),
    QWEN_API_KEY: optionalSecret,
    QWEN_BASE_URL: z.string().url().default('https://dashscope.aliyuncs.com/compatible-mode/v1'),
    GLM_API_KEY: optionalSecret,
    GLM_BASE_URL: z.string().url().default('https://open.bigmodel.cn/api/paas/v4'),
    DEEPSEEK_API_KEY: optionalSecret,
    DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),
    KIMI_API_KEY: optionalSecret,
    KIMI_BASE_URL: z.string().url().default('https://api.moonshot.cn/v1'),
    WANXIANG_API_KEY: optionalSecret,
    WANXIANG_BASE_URL: z.string().url().default('https://dashscope.aliyuncs.com/api/v1'),
    COGVIEW_API_KEY: optionalSecret,
    COGVIEW_BASE_URL: z.string().url().default('https://open.bigmodel.cn/api/paas/v4'),
    QWEN_MODEL_ID: optionalModelId,
    GLM_MODEL_ID: optionalModelId,
    DEEPSEEK_MODEL_ID: optionalModelId,
    KIMI_MODEL_ID: optionalModelId,
    QWEN_FALLBACK_ALIAS: optionalTextModelAlias,
    GLM_FALLBACK_ALIAS: optionalTextModelAlias,
    DEEPSEEK_FALLBACK_ALIAS: optionalTextModelAlias,
    KIMI_FALLBACK_ALIAS: optionalTextModelAlias,
    WANXIANG_MODEL_ID: optionalModelId,
    COGVIEW_MODEL_ID: optionalModelId,
    PROMPT_OPTIMIZER_MODEL: z.enum(['qwen', 'glm', 'deepseek']).default('qwen'),
    CHAT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    IMAGE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(5),
    IMAGE_DOWNLOAD_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(50_000_000)
      .default(10_000_000),
    ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(5),
    ADMIN_FIXED_CREDENTIALS_ENABLED: booleanFromEnv.default(true),
    ADMIN_SESSION_SECRET: adminSessionSecret,
    ADMIN_SESSION_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
    CHAT_MAX_TOKENS: z.coerce.number().int().min(1).max(4096).default(4096),
    PROVIDER_HEALTH_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
    PROVIDER_HEALTH_FAILURE_THRESHOLD: z.coerce.number().int().min(1).max(10).default(3),
    PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(60_000),
    PROVIDER_MAX_CONNECTIONS: z.coerce.number().int().min(1).max(200).default(20),
    PRICING_VERSION: z.string().min(1).default('dev-v1'),
    QWEN_INPUT_PRICE_CNY_PER_MILLION: optionalNonNegativeDecimal,
    QWEN_OUTPUT_PRICE_CNY_PER_MILLION: optionalNonNegativeDecimal,
    GLM_INPUT_PRICE_CNY_PER_MILLION: optionalNonNegativeDecimal,
    GLM_OUTPUT_PRICE_CNY_PER_MILLION: optionalNonNegativeDecimal,
    DEEPSEEK_INPUT_PRICE_CNY_PER_MILLION: optionalNonNegativeDecimal,
    DEEPSEEK_OUTPUT_PRICE_CNY_PER_MILLION: optionalNonNegativeDecimal,
    KIMI_INPUT_PRICE_CNY_PER_MILLION: optionalNonNegativeDecimal,
    KIMI_OUTPUT_PRICE_CNY_PER_MILLION: optionalNonNegativeDecimal,
  })
  .superRefine((env, context) => {
    if (
      env.NODE_ENV === 'production' &&
      env.ADMIN_SESSION_SECRET === 'development-only-admin-session-secret-change-me'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['ADMIN_SESSION_SECRET'],
        message: '生产环境必须配置独立的管理员会话密钥',
      })
    }
    if (env.NODE_ENV === 'production' && env.ADMIN_FIXED_CREDENTIALS_ENABLED) {
      context.addIssue({
        code: 'custom',
        path: ['ADMIN_FIXED_CREDENTIALS_ENABLED'],
        message: '生产环境禁止启用固定 root/123456 凭证；升级认证前必须关闭管理员登录',
      })
    }
    const providers = [
      { name: 'QWEN', enabled: env.QWEN_ENABLED, key: env.QWEN_API_KEY, model: env.QWEN_MODEL_ID },
      { name: 'GLM', enabled: env.GLM_ENABLED, key: env.GLM_API_KEY, model: env.GLM_MODEL_ID },
      {
        name: 'DEEPSEEK',
        enabled: env.DEEPSEEK_ENABLED,
        key: env.DEEPSEEK_API_KEY,
        model: env.DEEPSEEK_MODEL_ID,
      },
      { name: 'KIMI', enabled: env.KIMI_ENABLED, key: env.KIMI_API_KEY, model: env.KIMI_MODEL_ID },
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

    const fallbacks = [
      { alias: 'qwen', fallback: env.QWEN_FALLBACK_ALIAS },
      { alias: 'glm', fallback: env.GLM_FALLBACK_ALIAS },
      { alias: 'deepseek', fallback: env.DEEPSEEK_FALLBACK_ALIAS },
      { alias: 'kimi', fallback: env.KIMI_FALLBACK_ALIAS },
    ]
    for (const { alias, fallback } of fallbacks) {
      if (fallback === alias) {
        context.addIssue({
          code: 'custom',
          path: [`${alias.toUpperCase()}_FALLBACK_ALIAS`],
          message: 'fallback alias 不能与主模型 alias 相同',
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
