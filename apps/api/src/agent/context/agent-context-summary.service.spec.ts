import type { ModelInvocationPort, ModelInvocationRequest, ModelStreamEvent } from '../../chat/model-invocation.port'
import { AgentContextCompressionFailedError, AgentContextSummaryService } from './agent-context-summary.service'

const valid = JSON.stringify({
  userGoals: ['ship'],
  userConstraints: [],
  decisions: [],
  facts: [],
  openQuestions: [],
  pendingTasks: [],
  toolFindings: [],
  referencedArtifacts: [],
  recentOutcome: '',
  compressionNotes: ['reasoning omitted'],
})

function port(outputs: string[], requests: ModelInvocationRequest[]): ModelInvocationPort {
  let call = 0
  return {
    async *invoke(request): AsyncIterable<ModelStreamEvent> {
      requests.push(request)
      yield { type: 'text', delta: outputs[call++] ?? '' }
      yield {
        type: 'usage',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, usageUnknown: false },
      }
      yield { type: 'finish', finishReason: 'stop', provider: 'qwen', resolvedModel: 'qwen-test' }
    },
  }
}

describe('AgentContextSummaryService', () => {
  it('retries one invalid response, disables tools and returns a validated summary', async () => {
    const requests: ModelInvocationRequest[] = []
    const result = await new AgentContextSummaryService().generate({
      port: port(['not-json', valid], requests),
      modelId: 'qwen',
      messages: [{ role: 'user', content: 'history' }],
      signal: new AbortController().signal,
    })
    expect(requests).toHaveLength(2)
    expect(requests.every((request) => request.toolChoice === 'none' && request.tools?.length === 0))
      .toBe(true)
    expect(requests.every((request) => request.modelId === 'qwen' && request.allowFailover === false))
      .toBe(true)
    expect(result.content.userGoals).toEqual(['ship'])
    expect(result.usage.totalTokens).toBe(15)
  })

  it('ends after the retry also fails', async () => {
    await expect(new AgentContextSummaryService().generate({
      port: port(['bad', 'still bad'], []),
      modelId: 'qwen',
      messages: [],
      signal: new AbortController().signal,
    })).rejects.toBeInstanceOf(AgentContextCompressionFailedError)
  })
})
