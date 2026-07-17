import { PromptTemplateRegistry } from './prompt-template.registry'

describe('PromptTemplateRegistry', () => {
  it('provides one server-owned versioned template for each allowed mode', () => {
    const registry = new PromptTemplateRegistry()

    expect(registry.list().map(({ mode }) => mode)).toEqual(['expand', 'simplify', 'structure'])
    for (const template of registry.list()) {
      expect(template.version).toMatch(/^\d{4}-\d{2}-v\d+$/)
      expect(template.systemPrompt.length).toBeGreaterThan(20)
      expect(Object.isFrozen(template)).toBe(true)
    }
  })

  it('keeps mode instructions distinct and never interpolates user input into system templates', () => {
    const registry = new PromptTemplateRegistry()
    const prompts = registry.list().map(({ systemPrompt }) => systemPrompt)

    expect(new Set(prompts).size).toBe(3)
    expect(prompts.join('\n')).not.toContain('{{prompt}}')
  })
})
