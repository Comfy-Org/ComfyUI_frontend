import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock(import('../checks/devServer'), { spy: true })

import { probeDevServer } from '../checks/devServer'
import { customDistribution, resolveDistribution } from './distributions'
import { ensureDevServer } from './manager'

function thrownError(caught: unknown): Error {
  if (!(caught instanceof Error)) {
    throw new Error(`Expected a thrown Error, got ${String(caught)}`)
  }
  return caught
}

describe('ensureDevServer reuse of an already running dev server', () => {
  beforeEach(() => {
    vi.mocked(probeDevServer).mockResolvedValue({ status: 'ready' })
  })

  it('refuses to reuse a server it cannot prove is configured for --backend', async () => {
    const distribution = customDistribution('https://nightly.example.com/')

    await expect(ensureDevServer(distribution, '/checkout')).rejects.toThrow(
      /cannot\n?\s*tell which backend it proxies to/
    )
  })

  it('names the requested backend and the Access variables in the refusal', async () => {
    const distribution = customDistribution('https://nightly.example.com/')

    const thrown = await ensureDevServer(distribution, '/checkout').then(
      () => undefined,
      (caught: unknown) => caught
    )

    const { message } = thrownError(thrown)
    expect(message).toContain('https://nightly.example.com/')
    expect(message).toContain('DEV_SERVER_CF_ACCESS_CLIENT_ID')
    expect(message).toContain('COMFY_TEST_DEV_PORT=5174')
  })

  it('still reuses a running server for a named distribution', async () => {
    const distribution = resolveDistribution('cloud')
    if (!distribution) throw new Error('cloud distribution is missing')

    await expect(
      ensureDevServer(distribution, '/checkout')
    ).resolves.toMatchObject({ reused: true, ownedByUs: false })
  })
})
