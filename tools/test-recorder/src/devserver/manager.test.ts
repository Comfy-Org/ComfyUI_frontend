import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock(import('../checks/devServer'), { spy: true })

import { probeDevServer } from '../checks/devServer'
import { customDistribution, resolveDistribution } from './distributions'
import { devServerArgs, ensureDevServer } from './manager'

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

  // The refusal is only recoverable without stopping the other server if the
  // port it offers is one this recorder is not already watching.
  it('offers a port other than the one already serving', async () => {
    vi.stubEnv('COMFY_TEST_DEV_PORT', '5174')
    const distribution = customDistribution('https://nightly.example.com/')

    const thrown = await ensureDevServer(distribution, '/checkout').then(
      () => undefined,
      (caught: unknown) => caught
    )

    const { message } = thrownError(thrown)
    expect(message).toContain('already running on :5174')
    expect(message).toContain('COMFY_TEST_DEV_PORT=5175')
    expect(message).not.toContain('COMFY_TEST_DEV_PORT=5174 pnpm comfy-test')
  })

  it('still reuses a running server for a named distribution', async () => {
    const distribution = resolveDistribution('cloud')
    if (!distribution) throw new Error('cloud distribution is missing')

    await expect(
      ensureDevServer(distribution, '/checkout')
    ).resolves.toMatchObject({ reused: true, ownedByUs: false })
  })
})

describe('the dev server the recorder starts for itself', () => {
  // Vite walks upwards from :5173 when the port is taken, so an unpinned start
  // under COMFY_TEST_DEV_PORT produces a server the recorder never probes and
  // the run dies on the readiness timeout. This is the command the refusal
  // above tells the operator to run, so it has to land on the probed port.
  it('pins the port the recorder is probing', () => {
    vi.stubEnv('COMFY_TEST_DEV_PORT', '5174')

    expect(devServerArgs('dev')).toEqual([
      'run',
      'dev',
      '--port',
      '5174',
      '--strictPort'
    ])
  })

  it('pins the default port when none is configured', () => {
    expect(devServerArgs('dev:cloud')).toEqual([
      'run',
      'dev:cloud',
      '--port',
      '5173',
      '--strictPort'
    ])
  })

  // Vite ignores every argument after a bare `--`, so the port would be dropped
  // silently and the probe would wait out its timeout on the wrong port.
  it('passes the port without a bare argument separator', () => {
    expect(devServerArgs('dev')).not.toContain('--')
  })
})
