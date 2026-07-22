import { EmptyAgentMemoryProvider } from './agent-memory.provider'

describe('EmptyAgentMemoryProvider', () => {
  it('returns no memory without extracting conversation content', async () => {
    await expect(
      new EmptyAgentMemoryProvider().recall({ userId: 'user-1', threadId: 'thread-1' }),
    ).resolves.toEqual([])
  })
})
