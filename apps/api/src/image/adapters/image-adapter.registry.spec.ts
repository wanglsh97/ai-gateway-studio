import type { ImageAdapter } from './image-adapter'
import { ImageAdapterRegistry } from './image-adapter.registry'

function adapter(id: ImageAdapter['id']): ImageAdapter {
  return { id, resolvedModel: `${id}-v1`, submit: jest.fn(), getStatus: jest.fn() }
}

describe('ImageAdapterRegistry', () => {
  it('registers and lists provider-neutral image adapters', () => {
    const mock = adapter('mock')
    const wanxiang = adapter('wanxiang')
    const registry = new ImageAdapterRegistry([mock, wanxiang])

    expect(registry.get('mock')).toBe(mock)
    expect(registry.has('cogview')).toBe(false)
    expect(registry.list()).toEqual([mock, wanxiang])
  })

  it('rejects duplicate IDs and missing adapters', () => {
    expect(() => new ImageAdapterRegistry([adapter('mock'), adapter('mock')])).toThrow('duplicated')
    expect(() => new ImageAdapterRegistry([]).get('wanxiang')).toThrow('not registered')
  })
})
