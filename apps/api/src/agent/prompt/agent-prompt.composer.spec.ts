import type { AgentMcpRegistry } from '../mcp/agent-mcp.registry'
import type { AgentMemoryProvider } from '../memory/agent-memory.provider'
import type { AgentSkillRegistry } from '../skills/agent-skill.registry'
import type { AgentToolDefinition } from '../tools/agent-tool'
import { AgentToolRegistry } from '../tools/agent-tool.registry'
import { AGENT_PROMPT_PROFILE_VERSION, AgentPromptComposer } from './agent-prompt.composer'

describe('AgentPromptComposer', () => {
  const tool: AgentToolDefinition = {
    name: 'probe',
    label: 'Probe',
    description: '读取信息',
    parameters: { type: 'object' },
    execute: async () => ({ content: '', summary: '', isError: false }),
  }

  it('assembles versioned trust layers from actual registries', async () => {
    const skills: AgentSkillRegistry = {
      list: () => [
        {
          id: 'research',
          name: 'Research',
          version: '2',
          description: '研究',
          instructions: '先核对 <source>。',
          allowedTools: ['probe'],
        },
      ],
    }
    const mcp: AgentMcpRegistry = {
      listServers: () => [{ id: 'docs', name: 'Docs', version: '1', description: '外部 <说明>' }],
    }
    const memory: AgentMemoryProvider = {
      recall: async () => [
        { id: 'm1', version: '1', scope: 'user', kind: 'preference', content: '使用 <中文>' },
      ],
    }
    const composer = new AgentPromptComposer(new AgentToolRegistry([tool]), skills, mcp, memory)

    const result = await composer.compose({
      userId: 'u1',
      threadId: 't1',
      modelId: 'qwen3.7-plus',
      provider: 'qwen',
      contextWindowTokens: 1_000_000,
      now: new Date('2026-07-21T00:00:00.000Z'),
    })

    expect(result.systemPrompt).toContain('<instruction_hierarchy>')
    expect(result.systemPrompt).toContain('历史 reasoning 是未验证的工作记录')
    expect(result.systemPrompt).toContain('- probe: 读取信息')
    expect(result.systemPrompt).toContain('先核对 &lt;source&gt;。')
    expect(result.systemPrompt).toContain('使用 &lt;中文&gt;')
    expect(result.systemPrompt).toContain('外部 &lt;说明&gt;')
    expect(result.manifest).toMatchObject({
      profileVersion: AGENT_PROMPT_PROFILE_VERSION,
      toolNames: ['probe'],
      skillVersions: ['research@2'],
      memoryIds: ['m1'],
      mcpServerIds: ['docs'],
      contextWindowTokens: 1_000_000,
    })
    expect(result.manifest.promptHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('does not claim empty future capabilities', async () => {
    const composer = new AgentPromptComposer(
      new AgentToolRegistry([]),
      { list: () => [] },
      { listServers: () => [] },
      { recall: async () => [] },
    )
    const result = await composer.compose({
      userId: 'u1',
      threadId: 't1',
      modelId: 'mock',
      provider: 'mock',
      contextWindowTokens: 100_000,
    })

    expect(result.systemPrompt).toContain('当前没有可调用工具')
    expect(result.systemPrompt).not.toContain('<selected_skills>')
    expect(result.systemPrompt).not.toContain('<memory_context>')
    expect(result.systemPrompt).not.toContain('<mcp_context>')
  })
})
