import { describe, expect, it } from 'vitest'

import {
  WORKSPACE_LINK_PARAM,
  isWorkspaceId,
  readWorkspaceLink,
  withWorkspaceLink,
  withoutWorkspaceLink
} from './workspaceLink'

describe('isWorkspaceId', () => {
  it.for([
    ['a', true],
    ['ws-team_1', true],
    ['A'.repeat(128), true],
    ['', false],
    ['A'.repeat(129), false],
    ['ws/1', false],
    ['ws 1', false],
    ['ws?1', false]
  ] as const)('%s -> %s', ([value, expected]) => {
    expect(isWorkspaceId(value)).toBe(expected)
  })
})

describe('readWorkspaceLink', () => {
  it.for([
    ['a full URL', 'https://cloud.comfy.org/?workspace=ws-team'],
    ['a path and query', '/v1/checkout?product=comfyui&workspace=ws-team'],
    ['a bare query string', '?workspace=ws-team']
  ] as const)('reads the id from %s', ([, source]) => {
    expect(readWorkspaceLink(source)).toEqual({
      status: 'ok',
      workspaceId: 'ws-team'
    })
  })

  it('reads from a URL instance', () => {
    const url = new URL('https://cloud.comfy.org/?workspace=ws-team')
    expect(readWorkspaceLink(url)).toEqual({
      status: 'ok',
      workspaceId: 'ws-team'
    })
  })

  it('reads from URLSearchParams', () => {
    const params = new URLSearchParams('workspace=ws-team')
    expect(readWorkspaceLink(params)).toEqual({
      status: 'ok',
      workspaceId: 'ws-team'
    })
  })

  it.for([
    ['no query at all', 'https://cloud.comfy.org/'],
    ['a different param', 'https://cloud.comfy.org/?workspace_id=ws-team']
  ] as const)('reports absent for %s', ([, source]) => {
    expect(readWorkspaceLink(source)).toEqual({ status: 'absent' })
  })

  it.for([
    ['an empty value', 'https://cloud.comfy.org/?workspace='],
    ['an invalid charset', 'https://cloud.comfy.org/?workspace=ws/1'],
    [
      'a repeated parameter',
      'https://cloud.comfy.org/?workspace=ws-a&workspace=ws-b'
    ]
  ] as const)('reports invalid for %s', ([, source]) => {
    expect(readWorkspaceLink(source)).toEqual({ status: 'invalid' })
  })
})

describe('withWorkspaceLink', () => {
  it('returns a new URL carrying the id', () => {
    const original = new URL('https://cloud.comfy.org/settings')
    const linked = withWorkspaceLink(original, 'ws-team')

    expect(linked.href).toBe(
      'https://cloud.comfy.org/settings?workspace=ws-team'
    )
    expect(original.href).toBe('https://cloud.comfy.org/settings')
    expect(linked).not.toBe(original)
  })

  it('overwrites an existing value rather than duplicating the parameter', () => {
    const original = new URL('https://cloud.comfy.org/?workspace=ws-old')
    const linked = withWorkspaceLink(original, 'ws-new')

    expect(linked.searchParams.getAll(WORKSPACE_LINK_PARAM)).toEqual(['ws-new'])
  })

  it('throws RangeError on an id outside the shared charset', () => {
    const original = new URL('https://cloud.comfy.org/')
    expect(() => withWorkspaceLink(original, 'ws/1')).toThrow(RangeError)
  })
})

describe('withoutWorkspaceLink', () => {
  it('returns a new URL with the parameter removed', () => {
    const original = new URL(
      'https://cloud.comfy.org/?workspace=ws-team&tab=api'
    )
    const stripped = withoutWorkspaceLink(original)

    expect(stripped.href).toBe('https://cloud.comfy.org/?tab=api')
    expect(original.searchParams.has(WORKSPACE_LINK_PARAM)).toBe(true)
    expect(stripped).not.toBe(original)
  })

  it('is a no-op when the parameter is already absent', () => {
    const original = new URL('https://cloud.comfy.org/?tab=api')
    expect(withoutWorkspaceLink(original).href).toBe(original.href)
  })
})
