import { describe, it, expect } from 'vitest'
import { parseCheckpointQuestion } from './parseCheckpoint'

describe('parseCheckpointQuestion', () => {
  it('returns null for null input', () => {
    expect(parseCheckpointQuestion(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseCheckpointQuestion('')).toBeNull()
  })

  it('returns fallback for malformed JSON', () => {
    expect(parseCheckpointQuestion('not json')).toBe('Agent is waiting for input')
  })

  it('returns fallback for JSON with no known fields', () => {
    expect(parseCheckpointQuestion('{"unknown":"data"}')).toBe('Agent is waiting for input')
  })

  it('extracts properties.description', () => {
    const data = JSON.stringify({ properties: { description: 'Allow file write?' } })
    expect(parseCheckpointQuestion(data)).toBe('Allow file write?')
  })

  it('extracts properties.title when description is absent', () => {
    const data = JSON.stringify({ properties: { title: 'Permission needed' } })
    expect(parseCheckpointQuestion(data)).toBe('Permission needed')
  })

  it('extracts top-level message', () => {
    const data = JSON.stringify({ message: 'Approve this action?' })
    expect(parseCheckpointQuestion(data)).toBe('Approve this action?')
  })

  it('truncates strings longer than 500 characters', () => {
    const longText = 'A'.repeat(600)
    const data = JSON.stringify({ properties: { description: longText } })
    const result = parseCheckpointQuestion(data)
    expect(result).toHaveLength(503)
    expect(result!.endsWith('...')).toBe(true)
  })

  it('prefers properties.description over properties.title', () => {
    const data = JSON.stringify({ properties: { description: 'desc', title: 'title' } })
    expect(parseCheckpointQuestion(data)).toBe('desc')
  })
})
