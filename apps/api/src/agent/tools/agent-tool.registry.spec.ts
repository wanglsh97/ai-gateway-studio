import type { AgentToolDefinition } from './agent-tool'
import {
  AgentToolNotRegisteredError,
  AgentToolRegistry,
  DuplicateAgentToolError,
} from './agent-tool.registry'
import { webFetchFixtureTool } from './web-fetch-fixture.tool'

function fakeTool(name: string): AgentToolDefinition {
  return {
    name,
    description: name,
    label: name,
    parameters: { type: 'object' },
    execute: async () => ({ content: '', summary: '', isError: false }),
  }
}

describe('AgentToolRegistry', () => {
  it('resolves registered tools and rejects unknown ones', () => {
    const registry = new AgentToolRegistry([webFetchFixtureTool])
    expect(registry.has('web_fetch')).toBe(true)
    expect(registry.get('web_fetch').name).toBe('web_fetch')
    expect(registry.has('nonexistent_tool')).toBe(false)
    expect(() => registry.get('nonexistent_tool')).toThrow(AgentToolNotRegisteredError)
  })

  it('rejects duplicate tool names', () => {
    expect(() => new AgentToolRegistry([fakeTool('dup'), fakeTool('dup')])).toThrow(
      DuplicateAgentToolError,
    )
  })

  it('lists registered tools', () => {
    const registry = new AgentToolRegistry([fakeTool('a'), fakeTool('b')])
    expect(registry.list().map((tool) => tool.name)).toEqual(['a', 'b'])
  })
})

describe('webFetchFixtureTool', () => {
  const context = { toolCallId: 't1', signal: new AbortController().signal }

  it('returns deterministic content and audit for a valid URL', async () => {
    const result = await webFetchFixtureTool.execute({ url: 'https://example.com/' }, context)
    expect(result.isError).toBe(false)
    expect(result.content).toContain('https://example.com/')
    expect(result.audit).toMatchObject({
      requestedUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      status: 200,
      truncated: false,
    })
  })

  it('rejects missing url, invalid url and non-http protocols', async () => {
    await expect(webFetchFixtureTool.execute({ url: '' }, context)).rejects.toMatchObject({
      name: 'AgentToolExecutionError',
      code: 'WEB_FETCH_INVALID_ARGS',
    })
    await expect(
      webFetchFixtureTool.execute({ url: 'not a url' }, context),
    ).rejects.toMatchObject({ code: 'WEB_FETCH_INVALID_URL' })
    await expect(
      webFetchFixtureTool.execute({ url: 'ftp://example.com' }, context),
    ).rejects.toMatchObject({ code: 'WEB_FETCH_UNSUPPORTED_PROTOCOL' })
  })
})
