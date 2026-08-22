import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkBackend } from './backend'
import { checkPlatform, detectPlatform } from './platform'

describe('checkBackend', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('passes when the backend is running multi-user', async () => {
    vi.stubGlobal('fetch', (input: string | URL) =>
      Promise.resolve(
        String(input).includes('/api/users')
          ? new Response(JSON.stringify({ users: { abc: 'someone' } }))
          : new Response('{}')
      )
    )
    const result = await checkBackend()
    expect(result.ok).toBe(true)
    expect(result.optional).toBeFalsy()
  })

  it('warns rather than fails when the backend is up but not multi-user', async () => {
    vi.stubGlobal('fetch', (input: string | URL) =>
      Promise.resolve(
        String(input).includes('/api/users')
          ? new Response(JSON.stringify({ migrated: true }))
          : new Response('{}')
      )
    )
    const result = await checkBackend()
    expect(result.ok).toBe(true)
    expect(result.optional).toBe(true)
    expect(result.installInstructions?.join(' ')).toContain('--multi-user')
  })

  it('treats a malformed users value as not multi-user, not as a crash', async () => {
    vi.stubGlobal('fetch', (input: string | URL) =>
      Promise.resolve(
        String(input).includes('/api/users')
          ? new Response(JSON.stringify({ users: null }))
          : new Response('{}')
      )
    )
    const result = await checkBackend()
    expect(result.ok).toBe(true)
    expect(result.optional).toBe(true)
  })

  it('treats invalid JSON from /api/users as not multi-user, not as a crash', async () => {
    vi.stubGlobal('fetch', (input: string | URL) =>
      Promise.resolve(
        String(input).includes('/api/users')
          ? new Response('not json')
          : new Response('{}')
      )
    )
    const result = await checkBackend()
    expect(result.ok).toBe(true)
    expect(result.optional).toBe(true)
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
