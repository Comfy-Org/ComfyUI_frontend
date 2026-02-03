import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildAuthMetadata } from '../authMetadata'

describe('buildAuthMetadata', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('hashes user id for new users', async () => {
    const digestSpy = vi
      .spyOn(globalThis.crypto.subtle, 'digest')
      .mockResolvedValue(new Uint8Array([0, 1, 2, 255]).buffer)

    const metadata = await buildAuthMetadata('email', true, 'user-123')

    expect(digestSpy).toHaveBeenCalledWith(
      'SHA-256',
      new TextEncoder().encode('user-123')
    )
    expect(metadata).toMatchObject({
      method: 'email',
      is_new_user: true,
      user_id_hash: '000102ff'
    })
  })

  it('does not hash when user is not new', async () => {
    const digestSpy = vi.spyOn(globalThis.crypto.subtle, 'digest')

    const metadata = await buildAuthMetadata('google', false, 'user-123')

    expect(digestSpy).not.toHaveBeenCalled()
    expect(metadata).toMatchObject({
      method: 'google',
      is_new_user: false
    })
    expect(metadata.user_id_hash).toBeUndefined()
  })

  it('returns base metadata when crypto is unavailable', async () => {
    vi.stubGlobal('crypto', undefined)

    const metadata = await buildAuthMetadata('github', true, 'user-123')

    expect(metadata).toMatchObject({
      method: 'github',
      is_new_user: true
    })
    expect(metadata.user_id_hash).toBeUndefined()
  })
})
