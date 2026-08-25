import { describe, expect, it } from 'vitest'

import {
  CLOUD_CLIENT_IDS,
  LOCAL_CLIENT_IDS,
  MCP_CONNECTION_IDS,
  isConnectionId,
  isMcpClientId
} from './clients'

describe('isConnectionId', () => {
  it('accepts every declared connection id', () => {
    for (const id of MCP_CONNECTION_IDS) {
      expect(isConnectionId(id)).toBe(true)
    }
  })

  it.for([
    { label: 'a client id', value: 'claude-desktop' },
    { label: 'an empty string', value: '' },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'a number', value: 0 }
  ])('rejects $label', ({ value }) => {
    expect(isConnectionId(value)).toBe(false)
  })
})

describe('isMcpClientId', () => {
  it('accepts every declared cloud and local client id', () => {
    for (const id of [...CLOUD_CLIENT_IDS, ...LOCAL_CLIENT_IDS]) {
      expect(isMcpClientId(id)).toBe(true)
    }
  })

  it.for([
    { label: 'a connection id', value: 'cloud' },
    { label: 'an unprefixed local id', value: 'claude-code-local' },
    { label: 'an empty string', value: '' },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'an inherited Object property', value: 'toString' }
  ])('rejects $label', ({ value }) => {
    expect(isMcpClientId(value)).toBe(false)
  })

  it('keeps the cloud and local id sets disjoint', () => {
    const overlap = CLOUD_CLIENT_IDS.filter((id) =>
      (LOCAL_CLIENT_IDS as readonly string[]).includes(id)
    )

    expect(overlap).toEqual([])
  })
})
