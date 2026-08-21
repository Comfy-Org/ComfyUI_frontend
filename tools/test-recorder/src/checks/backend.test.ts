import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkBackend } from './backend'
import { checkPlatform, detectPlatform } from './platform'

describe('checkBackend', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('passes when the backend answers system_stats', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}')))
    expect((await checkBackend()).ok).toBe(true)
  })

  it('fails with the multi-user flag the tests need', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('ECONNREFUSED')))
    const result = await checkBackend()
    expect(result.ok).toBe(false)
    expect(result.installInstructions?.join(' ')).toContain('--multi-user')
  })

  it('fails on an error status rather than treating it as running', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('nope', { status: 500 }))
    )
    expect((await checkBackend()).ok).toBe(false)
  })
})

describe('detectPlatform', () => {
  it.for([
    ['darwin', 'macos'],
    ['win32', 'windows'],
    ['linux', 'linux'],
    ['freebsd', 'linux']
  ])('maps %s to %s', ([platform, expected]) => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue(
      platform as NodeJS.Platform
    )
    expect(detectPlatform()).toBe(expected)
  })

  it('always reports the operating system as satisfied', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(checkPlatform().ok).toBe(true)
  })
})
