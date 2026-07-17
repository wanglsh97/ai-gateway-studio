import { ImageAdapterError } from './image-adapter'
import { WanxiangImageAdapter } from './wanxiang-image-adapter'

function setup(responses: Response[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchImplementation = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), ...(init === undefined ? {} : { init }) })
    const response = responses.shift()
    if (!response) throw new Error('unexpected request')
    return response
  })
  return {
    adapter: new WanxiangImageAdapter({
      apiKey: 'test-key',
      baseUrl: 'https://dashscope.aliyuncs.com/api/v1/',
      modelId: 'wanx-v1',
      fetch: fetchImplementation,
    }),
    calls,
  }
}

describe('WanxiangImageAdapter fixture contract', () => {
  it('maps a normalized submit request to the asynchronous DashScope protocol', async () => {
    const context = setup([Response.json({ output: { task_id: 'wan-task-1' } })])

    await expect(
      context.adapter.submit({
        requestId: 'request-1',
        modelAlias: 'wanxiang',
        resolvedModel: 'wanx-v1',
        prompt: '山水画',
        size: '1024x1024',
        count: 2,
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({ providerTaskId: 'wan-task-1', status: 'pending' })

    expect(context.calls[0]?.url).toBe(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
    )
    expect(context.calls[0]?.init?.headers).toMatchObject({
      authorization: 'Bearer test-key',
      'x-dashscope-async': 'enable',
    })
    expect(JSON.parse(String(context.calls[0]?.init?.body))).toEqual({
      model: 'wanx-v1',
      input: { prompt: '山水画' },
      parameters: { size: '1024*1024', n: 2 },
    })
  })

  it.each([
    ['PENDING', { status: 'pending' }],
    ['RUNNING', { status: 'running' }],
  ])('maps %s task fixtures', async (taskStatus, expected) => {
    const { adapter } = setup([Response.json({ output: { task_status: taskStatus } })])

    await expect(
      adapter.getStatus({ providerTaskId: 'task/id', signal: new AbortController().signal }),
    ).resolves.toEqual(expected)
  })

  it('maps success results and proxies an allowlisted image download', async () => {
    const url = 'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/task/image.png'
    const context = setup([
      Response.json({ output: { task_status: 'SUCCEEDED', results: [{ url }] } }),
      new Response(Uint8Array.from([1, 2, 3]), {
        headers: { 'content-type': 'image/png; charset=binary' },
      }),
    ])

    await expect(
      context.adapter.getStatus({
        providerTaskId: 'task/id',
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({ status: 'succeeded', results: [{ url }] })
    await expect(
      context.adapter.download({ url, signal: new AbortController().signal }),
    ).resolves.toEqual({ body: Uint8Array.from([1, 2, 3]), contentType: 'image/png' })
    expect(context.calls[1]?.init?.redirect).toBe('error')
  })

  it('normalizes failed tasks, retryable HTTP errors, malformed fixtures and cancellation', async () => {
    const failed = setup([
      Response.json({
        output: { task_status: 'FAILED', code: 'DataInspectionFailed', message: 'blocked' },
      }),
    ]).adapter
    await expect(
      failed.getStatus({ providerTaskId: 'task-1', signal: new AbortController().signal }),
    ).resolves.toEqual({
      status: 'failed',
      errorCode: 'DataInspectionFailed',
      errorMessage: 'blocked',
    })

    const unavailable = setup([Response.json({}, { status: 503 })]).adapter
    await expect(
      unavailable.submit({
        requestId: 'request-1',
        modelAlias: 'wanxiang',
        resolvedModel: 'wanx-v1',
        prompt: 'test',
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ options: { retryable: true, statusCode: 503 } })

    const unsafe = setup([
      Response.json({
        output: {
          task_status: 'SUCCEEDED',
          results: [{ url: 'http://127.0.0.1/private.png' }],
        },
      }),
    ]).adapter
    await expect(
      unsafe.getStatus({ providerTaskId: 'task-1', signal: new AbortController().signal }),
    ).rejects.toBeInstanceOf(ImageAdapterError)

    const controller = new AbortController()
    controller.abort(new DOMException('cancelled', 'AbortError'))
    const cancelled = new WanxiangImageAdapter({
      apiKey: 'test-key',
      baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
      modelId: 'wanx-v1',
      fetch: async (_input, init) => {
        throw init?.signal?.reason
      },
    })
    await expect(
      cancelled.getStatus({ providerTaskId: 'task-1', signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
