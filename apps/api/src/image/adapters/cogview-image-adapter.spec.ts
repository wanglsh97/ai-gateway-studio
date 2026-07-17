import { ImageAdapterError } from './image-adapter'
import { CogViewImageAdapter } from './cogview-image-adapter'

function setup(responses: Response[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const adapter = new CogViewImageAdapter({
    apiKey: 'test-key',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
    modelId: 'cogview-4-250304',
    fetch: async (input, init) => {
      calls.push({ url: String(input), ...(init === undefined ? {} : { init }) })
      const response = responses.shift()
      if (!response) throw new Error('unexpected request')
      return response
    },
  })
  return { adapter, calls }
}

describe('CogViewImageAdapter fixture contract', () => {
  it('maps the synchronous CogView response to a persisted terminal submission', async () => {
    const url = 'https://cdn.bigmodel.cn/generated/image.png'
    const context = setup([
      Response.json(
        { created: 1, data: [{ url }] },
        { headers: { 'x-request-id': 'cogview-request-1' } },
      ),
    ])

    await expect(
      context.adapter.submit({
        requestId: 'platform-request-1',
        modelAlias: 'cogview',
        resolvedModel: 'cogview-4-250304',
        prompt: '一只熊猫',
        size: '1024x1024',
        count: 1,
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({
      providerTaskId: 'cogview-request-1',
      status: 'succeeded',
      results: [{ url }],
    })
    expect(context.calls[0]?.url).toBe('https://open.bigmodel.cn/api/paas/v4/images/generations')
    expect(context.calls[0]?.init?.headers).toMatchObject({ authorization: 'Bearer test-key' })
    expect(JSON.parse(String(context.calls[0]?.init?.body))).toEqual({
      model: 'cogview-4-250304',
      prompt: '一只熊猫',
      size: '1024x1024',
      user_id: 'platform-request-1',
    })
  })

  it('downloads only provider-owned HTTPS result URLs without forwarding credentials', async () => {
    const url = 'https://cdn.bigmodel.cn/generated/image.webp'
    const context = setup([
      new Response(Uint8Array.from([4, 5]), { headers: { 'content-type': 'image/webp' } }),
    ])

    await expect(
      context.adapter.download({ url, signal: new AbortController().signal }),
    ).resolves.toEqual({ body: Uint8Array.from([4, 5]), contentType: 'image/webp' })
    expect(context.calls[0]?.init?.headers).toEqual({})
    expect(context.calls[0]?.init?.redirect).toBe('error')
  })

  it('rejects unsupported count, polling, unsafe URLs and retryable upstream failures', async () => {
    const context = setup([])
    await expect(
      context.adapter.submit({
        requestId: 'request-1',
        modelAlias: 'cogview',
        resolvedModel: 'cogview-4',
        prompt: 'test',
        count: 2,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ options: { code: 'COGVIEW_COUNT_NOT_SUPPORTED' } })
    await expect(
      context.adapter.getStatus({
        providerTaskId: 'sync-result',
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ options: { code: 'COGVIEW_STATUS_NOT_SUPPORTED' } })
    await expect(
      context.adapter.download({
        url: 'http://127.0.0.1/private',
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(ImageAdapterError)

    const unavailable = setup([Response.json({}, { status: 503 })]).adapter
    await expect(
      unavailable.submit({
        requestId: 'request-1',
        modelAlias: 'cogview',
        resolvedModel: 'cogview-4',
        prompt: 'test',
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ options: { retryable: true, statusCode: 503 } })
  })
})
