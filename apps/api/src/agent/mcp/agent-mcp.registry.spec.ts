import { EmptyAgentMcpRegistry } from './agent-mcp.registry'

describe('EmptyAgentMcpRegistry', () => {
  it('returns no servers and performs no discovery', () => {
    expect(new EmptyAgentMcpRegistry().listServers()).toEqual([])
  })
})
