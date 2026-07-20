/**
 * 轻量 JSON Schema 参数校验（仅覆盖 Agent 工具所需的 object/string/required/additionalProperties）。
 * 不引入 Ajv：保持依赖面小，并在 registry 层 fail-closed 拒绝无效参数。
 */

export interface ToolArgsValidationSuccess {
  ok: true
  args: Record<string, unknown>
}

export interface ToolArgsValidationFailure {
  ok: false
  code: 'AGENT_TOOL_INVALID_ARGS'
  message: string
  issues: string[]
}

export type ToolArgsValidationResult = ToolArgsValidationSuccess | ToolArgsValidationFailure

export function validateToolArguments(
  parameters: Record<string, unknown>,
  raw: unknown,
): ToolArgsValidationResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail('参数必须是 JSON 对象')
  }
  const args = { ...(raw as Record<string, unknown>) }

  if (parameters.type !== undefined && parameters.type !== 'object') {
    return fail('工具 schema 仅支持 type=object')
  }

  const properties =
    parameters.properties && typeof parameters.properties === 'object' && !Array.isArray(parameters.properties)
      ? (parameters.properties as Record<string, Record<string, unknown>>)
      : {}

  const required = Array.isArray(parameters.required)
    ? parameters.required.filter((item): item is string => typeof item === 'string')
    : []

  for (const key of required) {
    if (!(key in args) || args[key] === undefined) {
      return fail(`缺少必填参数：${key}`)
    }
  }

  if (parameters.additionalProperties === false) {
    for (const key of Object.keys(args)) {
      if (!(key in properties)) {
        return fail(`不允许的额外参数：${key}`)
      }
    }
  }

  for (const [key, schema] of Object.entries(properties)) {
    if (!(key in args)) continue
    const value = args[key]
    const expectedType = schema.type
    if (expectedType === 'string') {
      if (typeof value !== 'string') {
        return fail(`参数 ${key} 必须是 string`)
      }
      const minLength = typeof schema.minLength === 'number' ? schema.minLength : undefined
      if (minLength !== undefined && value.length < minLength) {
        return fail(`参数 ${key} 长度不得小于 ${minLength}`)
      }
    } else if (expectedType === 'number') {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return fail(`参数 ${key} 必须是 number`)
      }
    } else if (expectedType === 'boolean') {
      if (typeof value !== 'boolean') {
        return fail(`参数 ${key} 必须是 boolean`)
      }
    } else if (expectedType === 'object') {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return fail(`参数 ${key} 必须是 object`)
      }
    } else if (expectedType === 'array') {
      if (!Array.isArray(value)) {
        return fail(`参数 ${key} 必须是 array`)
      }
    }
  }

  return { ok: true, args }
}

function fail(message: string): ToolArgsValidationFailure {
  return {
    ok: false,
    code: 'AGENT_TOOL_INVALID_ARGS',
    message,
    issues: [message],
  }
}
