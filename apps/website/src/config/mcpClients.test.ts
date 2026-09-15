import { describe, expect, it } from 'vitest'

import {
  createMcpConnections,
  isConnectionId,
  isMcpClientId
} from './mcpClients'

const connections = createMcpConnections('en')

describe('isConnectionId', () => {
  it.for([{ value: 'cloud' }, { value: 'local' }])(
    'accepts $value',
    ({ value }) => {
      expect(isConnectionId(value, connections)).toBe(true)
    }
  )

  it.for([
    { label: 'a client id', value: 'claude-desktop' },
    { label: 'an empty string', value: '' },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'a number', value: 0 }
  ])('rejects $label', ({ value }) => {
    expect(isConnectionId(value, connections)).toBe(false)
  })
})

describe('isMcpClientId', () => {
  it.for([
    { value: 'claude-desktop' },
    { value: 'claude-code' },
    { value: 'codex' },
    { value: 'cursor' },
    { value: 'openclaw' },
    { value: 'other' },
    { value: 'local-claude-code' },
    { value: 'local-claude-desktop' },
    { value: 'local-cursor' },
    { value: 'local-other' }
  ])('accepts $value', ({ value }) => {
    expect(isMcpClientId(value, connections)).toBe(true)
  })

  it.for([
    { label: 'a connection id', value: 'cloud' },
    { label: 'an unprefixed local id', value: 'claude-code-local' },
    { label: 'an empty string', value: '' },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'an inherited Object property', value: 'toString' }
  ])('rejects $label', ({ value }) => {
    expect(isMcpClientId(value, connections)).toBe(false)
  })
})
