/**
 * Pi 运行时加载器。
 *
 * `@earendil-works/pi-ai` 与 `@earendil-works/pi-agent-core` 是纯 ESM 包，其 `exports`
 * 只提供 `import` 条件；NestJS 以 CommonJS 运行，直接 `require` 会失败。这里用原生动态
 * `import()` 惰性加载并缓存。为避免 TypeScript 在 `module: CommonJS` 下把 `import()`
 * 降级为 `require()`，通过 Function 构造保留原生动态 import。
 */
const nativeImport = new Function('specifier', 'return import(specifier)') as <T>(
  specifier: string,
) => Promise<T>

type PiAiModule = typeof import('@earendil-works/pi-ai')
type PiAgentCoreModule = typeof import('@earendil-works/pi-agent-core')

let piAiPromise: Promise<PiAiModule> | undefined
let piAgentCorePromise: Promise<PiAgentCoreModule> | undefined

export function loadPiAi(): Promise<PiAiModule> {
  piAiPromise ??= nativeImport<PiAiModule>('@earendil-works/pi-ai')
  return piAiPromise
}

export function loadPiAgentCore(): Promise<PiAgentCoreModule> {
  piAgentCorePromise ??= nativeImport<PiAgentCoreModule>('@earendil-works/pi-agent-core')
  return piAgentCorePromise
}
