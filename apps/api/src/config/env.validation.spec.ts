import { validateEnvironment } from './env.validation'

const requiredEnvironment = {
  DATABASE_URL: 'postgresql://aigateway:password@localhost:5432/aigateway',
  REDIS_URL: 'redis://localhost:6379',
}

describe('validateEnvironment', () => {
  it('applies safe defaults for a Mock-only environment', () => {
    const environment = validateEnvironment(requiredEnvironment)

    expect(environment.MOCK_PROVIDER_ENABLED).toBe(true)
    expect(environment.QWEN_ENABLED).toBe(false)
    expect(environment.QWEN_BASE_URL).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1')
    expect(environment.GLM_BASE_URL).toBe('https://open.bigmodel.cn/api/paas/v4')
    expect(environment.DEEPSEEK_BASE_URL).toBe('https://api.deepseek.com')
    expect(environment.KIMI_ENABLED).toBe(false)
    expect(environment.KIMI_BASE_URL).toBe('https://api.moonshot.cn/v1')
    expect(environment.API_PORT).toBe(3001)
    expect(environment.TRUSTED_PROXY_HOPS).toBe(1)
    expect(environment.CHAT_RATE_LIMIT_PER_MINUTE).toBe(10)
    expect(environment.CHAT_MAX_TOKENS).toBe(4096)
    expect(environment.PROVIDER_TIMEOUT_MS).toBe(60_000)
    expect(environment.PROVIDER_MAX_CONNECTIONS).toBe(20)
    expect(environment.ADMIN_SESSION_TTL_SECONDS).toBe(900)
    expect(environment.ADMIN_FIXED_CREDENTIALS_ENABLED).toBe(true)
  })

  it('rejects an unsafe trusted proxy hop count', () => {
    expect(() => validateEnvironment({ ...requiredEnvironment, TRUSTED_PROXY_HOPS: '6' })).toThrow(
      'TRUSTED_PROXY_HOPS',
    )
  })

  it('requires key and model id when a real provider is enabled', () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        QWEN_ENABLED: 'true',
      }),
    ).toThrow('QWEN_API_KEY')
  })

  it('requires an independent administrator session secret in production', () => {
    expect(() => validateEnvironment({ ...requiredEnvironment, NODE_ENV: 'production' })).toThrow(
      'ADMIN_SESSION_SECRET',
    )
  })

  it('blocks fixed development credentials in production', () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        ADMIN_SESSION_SECRET: 'production-session-secret-with-32-characters',
      }),
    ).toThrow('ADMIN_FIXED_CREDENTIALS_ENABLED')

    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        ADMIN_SESSION_SECRET: 'production-session-secret-with-32-characters',
        ADMIN_FIXED_CREDENTIALS_ENABLED: 'false',
      }),
    ).not.toThrow()
  })

  it('does not include configured secret values in validation errors', () => {
    const secret = 'never-print-this-key'

    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        QWEN_ENABLED: 'true',
        QWEN_API_KEY: secret,
      }),
    ).toThrow('QWEN_MODEL_ID')

    try {
      validateEnvironment({
        ...requiredEnvironment,
        QWEN_ENABLED: 'true',
        QWEN_API_KEY: secret,
      })
    } catch (error) {
      expect(String(error)).not.toContain(secret)
    }
  })
})
