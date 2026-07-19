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
    expect(environment.WANXIANG_BASE_URL).toBe('https://dashscope.aliyuncs.com/api/v1')
    expect(environment.COGVIEW_BASE_URL).toBe('https://open.bigmodel.cn/api/paas/v4')
    expect(environment.API_PORT).toBe(3001)
    expect(environment.TRUSTED_PROXY_HOPS).toBe(1)
    expect(environment.GITHUB_OAUTH_ENABLED).toBe(false)
    expect(environment.GITHUB_CALLBACK_URL).toBe(
      'http://localhost:3001/api/v1/auth/github/callback',
    )
    expect(environment.GITHUB_OAUTH_HTTP_TIMEOUT_MS).toBe(10_000)
    expect(environment.USER_SESSION_TTL_SECONDS).toBe(2_592_000)
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

  it.each(['QWEN', 'GLM', 'DEEPSEEK', 'KIMI', 'WANXIANG', 'COGVIEW'] as const)(
    'allows the %s alias to be enabled independently',
    (alias) => {
      const environment = validateEnvironment({
        ...requiredEnvironment,
        [`${alias}_ENABLED`]: 'true',
        [`${alias}_API_KEY`]: `${alias.toLowerCase()}-test-key`,
        [`${alias}_MODEL_ID`]: `${alias.toLowerCase()}-test-model`,
      })

      expect(environment[`${alias}_ENABLED`]).toBe(true)
      for (const otherAlias of [
        'QWEN',
        'GLM',
        'DEEPSEEK',
        'KIMI',
        'WANXIANG',
        'COGVIEW',
      ] as const) {
        if (otherAlias !== alias) expect(environment[`${otherAlias}_ENABLED`]).toBe(false)
      }
    },
  )

  it('requires an independent administrator session secret in production', () => {
    expect(() => validateEnvironment({ ...requiredEnvironment, NODE_ENV: 'production' })).toThrow(
      'ADMIN_SESSION_SECRET',
    )
  })

  it('requires GitHub credentials when OAuth is enabled', () => {
    expect(() =>
      validateEnvironment({ ...requiredEnvironment, GITHUB_OAUTH_ENABLED: 'true' }),
    ).toThrow('GITHUB_CLIENT_ID')
  })

  it('enforces the fixed 30-day user session lifetime', () => {
    expect(() =>
      validateEnvironment({ ...requiredEnvironment, USER_SESSION_TTL_SECONDS: '3600' }),
    ).toThrow('USER_SESSION_TTL_SECONDS')
  })

  it('blocks fixed development credentials in production', () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        GITHUB_OAUTH_ENABLED: 'true',
        GITHUB_CLIENT_ID: 'github-client-id',
        GITHUB_CLIENT_SECRET: 'github-client-secret',
        GITHUB_CALLBACK_URL: 'https://example.com/api/v1/auth/github/callback',
        USER_SESSION_SECRET: 'production-user-session-secret-with-32-characters',
        ADMIN_SESSION_SECRET: 'production-session-secret-with-32-characters',
      }),
    ).toThrow('ADMIN_FIXED_CREDENTIALS_ENABLED')

    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        GITHUB_OAUTH_ENABLED: 'true',
        GITHUB_CLIENT_ID: 'github-client-id',
        GITHUB_CLIENT_SECRET: 'github-client-secret',
        GITHUB_CALLBACK_URL: 'https://example.com/api/v1/auth/github/callback',
        USER_SESSION_SECRET: 'production-user-session-secret-with-32-characters',
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

  it('does not include GitHub or session secrets in validation errors', () => {
    const githubSecret = 'github-secret-never-print'
    const sessionSecret = 'session-secret-never-print-with-32-characters'

    try {
      validateEnvironment({
        ...requiredEnvironment,
        GITHUB_OAUTH_ENABLED: 'true',
        GITHUB_CLIENT_SECRET: githubSecret,
        USER_SESSION_SECRET: sessionSecret,
      })
    } catch (error) {
      expect(String(error)).not.toContain(githubSecret)
      expect(String(error)).not.toContain(sessionSecret)
    }
  })
})
