import {
  assertImageTaskTransition,
  canTransitionImageTask,
  ImageTaskTransitionError,
  isTerminalImageTaskStatus,
} from './image-task-state'

describe('Image task state machine', () => {
  it.each([
    ['pending', 'running'],
    ['pending', 'succeeded'],
    ['pending', 'failed'],
    ['running', 'succeeded'],
    ['running', 'failed'],
    ['succeeded', 'succeeded'],
    ['failed', 'failed'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransitionImageTask(from, to)).toBe(true)
    expect(() => assertImageTaskTransition(from, to)).not.toThrow()
  })

  it.each([
    ['running', 'pending'],
    ['succeeded', 'running'],
    ['succeeded', 'failed'],
    ['failed', 'running'],
    ['failed', 'succeeded'],
  ] as const)('rejects terminal or backward transition %s -> %s', (from, to) => {
    expect(() => assertImageTaskTransition(from, to)).toThrow(ImageTaskTransitionError)
  })

  it('identifies only succeeded and failed as terminal', () => {
    expect(isTerminalImageTaskStatus('pending')).toBe(false)
    expect(isTerminalImageTaskStatus('running')).toBe(false)
    expect(isTerminalImageTaskStatus('succeeded')).toBe(true)
    expect(isTerminalImageTaskStatus('failed')).toBe(true)
  })
})
