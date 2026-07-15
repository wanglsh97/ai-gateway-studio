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
    expect(environment.API_PORT).toBe(3001)
    expect(environment.CHAT_MAX_TOKENS).toBe(4096)
  })

  it('requires key and model id when a real provider is enabled', () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        QWEN_ENABLED: 'true',
      }),
    ).toThrow('QWEN_API_KEY')
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
