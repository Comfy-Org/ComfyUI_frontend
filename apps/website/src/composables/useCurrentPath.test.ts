import { describe, expect, it } from 'vitest'

import { isHrefActive } from './useCurrentPath'

describe('isHrefActive', () => {
  it('matches the current page', () => {
    expect(isHrefActive('/mcp', '/mcp')).toBe(true)
  })

  it('does not match other pages', () => {
    expect(isHrefActive('/mcp', '/pricing')).toBe(false)
  })

  it('matches regardless of a trailing slash', () => {
    expect(isHrefActive('/mcp', '/mcp/')).toBe(true)
  })

  it('ignores query and hash on the href', () => {
    expect(isHrefActive('/mcp?ref=banner#setup', '/mcp')).toBe(true)
  })

  it('never matches an external href', () => {
    expect(
      isHrefActive('https://docs.comfy.org/agent-tools/cloud', '/mcp')
    ).toBe(false)
  })

  it('never matches an empty href', () => {
    expect(isHrefActive('', '/mcp')).toBe(false)
  })
})
