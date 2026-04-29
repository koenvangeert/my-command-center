import { describe, expect, it } from 'vitest'
import { getProjectTerminalTaskId } from './projectTerminal'

describe('projectTerminal', () => {
  it('uses a project-scoped terminal task id so main terminals do not collide with task terminals', () => {
    expect(getProjectTerminalTaskId('P-123')).toBe('project-P-123')
  })
})
