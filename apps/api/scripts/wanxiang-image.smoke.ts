import { randomUUID } from 'node:crypto'

import { WanxiangImageAdapter } from '../src/image/adapters/wanxiang-image-adapter'

const pollIntervalMs = 2_000
const timeoutMs = 120_000

void main()

async function main(): Promise<void> {
  const apiKey = requiredEnvironment('WANXIANG_API_KEY')
  const modelId = requiredEnvironment('WANXIANG_MODEL_ID')
  const baseUrl = process.env.WANXIANG_BASE_URL ?? 'https://dashscope.aliyuncs.com/api/v1'
  const adapter = new WanxiangImageAdapter({ apiKey, baseUrl, modelId })
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Wanxiang smoke timeout', 'AbortError')),
    timeoutMs,
  )

  try {
    const submission = await adapter.submit({
      requestId: randomUUID(),
      modelAlias: 'wanxiang',
      resolvedModel: modelId,
      prompt: '一枚蓝色圆形图标，纯白背景，极简扁平风格，不含文字',
      size: '1024x1024',
      count: 1,
      signal: controller.signal,
    })

    let status = await adapter.getStatus({
      providerTaskId: submission.providerTaskId,
      signal: controller.signal,
    })
    while (status.status === 'pending' || status.status === 'running') {
      await delay(pollIntervalMs, controller.signal)
      status = await adapter.getStatus({
        providerTaskId: submission.providerTaskId,
        signal: controller.signal,
      })
    }
    if (status.status !== 'succeeded' || status.results.length !== 1) {
      throw new Error(`Wanxiang smoke failed with status ${status.status}`)
    }

    const image = await adapter.download({ url: status.results[0]!.url, signal: controller.signal })
    if (image.body.byteLength === 0 || !image.contentType.startsWith('image/')) {
      throw new Error('Wanxiang smoke returned an invalid image download')
    }
    console.log(
      JSON.stringify({
        provider: 'wanxiang',
        modelId,
        providerTaskId: submission.providerTaskId,
        status: status.status,
        resultCount: status.results.length,
        contentType: image.contentType,
        bytes: image.body.byteLength,
      }),
    )
  } finally {
    clearTimeout(timeout)
  }
}

function requiredEnvironment(name: 'WANXIANG_API_KEY' | 'WANXIANG_MODEL_ID'): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for the explicit Wanxiang smoke test`)
  return value
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}
