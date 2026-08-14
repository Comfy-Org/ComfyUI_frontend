import { describe, expect, it } from 'vitest'

import { MCP_CLIENT_IDS, createMcpClients, isMcpClientId } from './clients'

describe('isMcpClientId', () => {
  it('accepts every declared client id', () => {
    for (const id of MCP_CLIENT_IDS) {
      expect(isMcpClientId(id)).toBe(true)
    }
  })

  it.for([
    { label: 'an unknown string', value: 'claude-desktop-v2' },
    { label: 'an empty string', value: '' },
    { label: 'a number', value: 0 },
    { label: 'undefined', value: undefined },
    { label: 'null', value: null },
    { label: 'an object', value: { id: 'cursor' } }
  ])('rejects $label', ({ value }) => {
    expect(isMcpClientId(value)).toBe(false)
  })

  it('rejects inherited Object properties', () => {
    expect(isMcpClientId('toString')).toBe(false)
    expect(isMcpClientId('constructor')).toBe(false)
  })
})

describe('createMcpClients', () => {
  it('builds exactly one entry per declared client id', () => {
    const ids = createMcpClients('en').map((client) => client.id)

    expect(ids).toEqual([...MCP_CLIENT_IDS])
  })
})
