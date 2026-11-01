import { beforeEach, describe, expect, it } from 'vitest'

import {
  captureSafeExtensionBoot,
  isSafeExtensionBoot,
  isSafeExtensionBootActive
} from './safeExtensionBoot'

describe('isSafeExtensionBoot', () => {
  it.for([
    { search: '?safe', expected: true },
    { search: '?safe=1', expected: true },
    { search: '?safe=true', expected: true },
    { search: '?safe=0', expected: false },
    { search: '?safe=false', expected: false },
    { search: '', expected: false }
  ])('reads $search as $expected', ({ search, expected }) => {
    expect(isSafeExtensionBoot(search)).toBe(expected)
  })
})

describe('captureSafeExtensionBoot', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    captureSafeExtensionBoot()
  })

  it('keeps safe mode for this load and drops the flag from the URL', () => {
    window.history.replaceState({ kept: true }, '', '/?safe&workflow=a#graph')

    captureSafeExtensionBoot()

    expect(window.location.search).toBe('?workflow=a')
    expect(window.location.hash).toBe('#graph')
    expect(window.history.state).toEqual({ kept: true })
    expect(isSafeExtensionBootActive()).toBe(true)
  })

  it('leaves a URL without the flag untouched', () => {
    window.history.replaceState(null, '', '/?safe=0&workflow=a')

    captureSafeExtensionBoot()

    expect(window.location.search).toBe('?safe=0&workflow=a')
    expect(isSafeExtensionBootActive()).toBe(false)
  })

  it('ignores a flag that reaches the URL after startup', () => {
    window.history.replaceState(null, '', '/?safe=1')

    expect(isSafeExtensionBootActive()).toBe(false)
  })
})
