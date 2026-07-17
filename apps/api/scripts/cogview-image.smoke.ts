import { randomUUID } from 'node:crypto'

import { CogViewImageAdapter } from '../src/image/adapters/cogview-image-adapter'

const timeoutMs = 120_000

void main()

async function main(): Promise<void> {
  const apiKey = requiredEnvironment('COGVIEW_API_KEY')
  const modelId = requiredEnvironment('COGVIEW_MODEL_ID')
  const baseUrl = process.env.COGVIEW_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4'
  const adapter = new CogViewImageAdapter({ apiKey, baseUrl, modelId })
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(new DOMException('CogView smoke timeout', 'AbortError')),
    timeoutMs,
  )

  try {
    const submission = await adapter.submit({
      requestId: randomUUID(),
      modelAlias: 'cogview',
      resolvedModel: modelId,
      prompt: '一枚绿色方形图标，纯白背景，极简扁平风格，不含文字',
      size: '1024x1024',
      count: 1,
      signal: controller.signal,
    })
    if (submission.status !== 'succeeded' || submission.results.length !== 1) {
      throw new Error(`CogView smoke failed with status ${submission.status}`)
    }

    const image = await adapter.download({
      url: submission.results[0]!.url,
      signal: controller.signal,
    })
    if (image.body.byteLength === 0 || !image.contentType.startsWith('image/')) {
      throw new Error('CogView smoke returned an invalid image download')
    }
    console.log(
      JSON.stringify({
        provider: 'cogview',
        modelId,
        providerTaskId: submission.providerTaskId,
        status: submission.status,
        resultCount: submission.results.length,
        contentType: image.contentType,
        bytes: image.body.byteLength,
      }),
    )
  } finally {
    clearTimeout(timeout)
  }
}

function requiredEnvironment(name: 'COGVIEW_API_KEY' | 'COGVIEW_MODEL_ID'): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for the explicit CogView smoke test`)
  return value
}
