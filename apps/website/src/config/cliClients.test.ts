import { describe, expect, it } from 'vitest'

import { isCliClientId } from './cliClients'

describe('isCliClientId', () => {
  it.for([
    { value: 'claude-code' },
    { value: 'codex' },
    { value: 'cursor' },
    { value: 'gemini-cli' },
    { value: 'openclaw' },
    { value: 'hermes' },
    { value: 'terminal' },
    { value: 'ci' }
  ])('accepts $value', ({ value }) => {
    expect(isCliClientId(value)).toBe(true)
  })

  it.for([
    { label: 'an mcp-only client id', value: 'claude-desktop' },
    { label: 'an empty string', value: '' },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'a number', value: 0 },
    { label: 'an inherited Object property', value: 'toString' }
  ])('rejects $label', ({ value }) => {
    expect(isCliClientId(value)).toBe(false)
  })
})
