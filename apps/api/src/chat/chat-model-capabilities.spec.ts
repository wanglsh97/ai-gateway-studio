import { resolveChatModelCapabilities, canAdvertiseAgentCapability } from './chat-model-capabilities'

describe('chat model capabilities', () => {
  it('always includes chat and prompt for text models', () => {
    expect(
      resolveChatModelCapabilities({
        modelId: 'qwen3.7-plus',
        provider: 'qwen',
        providerConfigured: true,
        mockAvailable: false,
      }),
    ).toEqual(['chat', 'prompt'])
  })

  it('advertises agent for Mock-backed catalog entries before real smoke', () => {
    expect(
      canAdvertiseAgentCapability({
        modelId: 'qwen3.7-plus',
        provider: 'qwen',
        providerConfigured: false,
        mockAvailable: true,
      }),
    ).toBe(true)
    expect(
      resolveChatModelCapabilities({
        modelId: 'qwen3.7-plus',
        provider: 'qwen',
        providerConfigured: false,
        mockAvailable: true,
      }),
    ).toEqual(['chat', 'prompt', 'agent'])
  })

  it('does not advertise agent for unverified real providers even when Mock is also present', () => {
    expect(
      canAdvertiseAgentCapability({
        modelId: 'qwen3.7-plus',
        provider: 'qwen',
        providerConfigured: true,
        mockAvailable: true,
      }),
    ).toBe(false)
  })

  it('does not advertise agent when neither provider nor Mock can serve', () => {
    expect(
      canAdvertiseAgentCapability({
        modelId: 'qwen3.7-plus',
        provider: 'qwen',
        providerConfigured: false,
        mockAvailable: false,
      }),
    ).toBe(false)
  })
})
