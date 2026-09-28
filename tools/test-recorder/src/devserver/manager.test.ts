import type * as childProcess from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The startup branch is worth asserting at the boundary it actually crosses,
// so `spawn` is replaced rather than the argv helper behind it. `spawnedChild`
// is the narrow surface ensureDevServer touches; `pid` is undefined so the
// `stop()` it returns short-circuits instead of signalling a process group
// this test never owned. `node:child_process` is CJS-backed and its namespace
// is not configurable, so neither `{ spy: true }` nor `vi.spyOn` reaches the
// binding manager.ts holds - both the default and the named export have to
// carry the same mock, as in pr/openPr.test.ts.
const { spawn, spawnedChild } = vi.hoisted(() => {
  const child = {
    pid: undefined as number | undefined,
    exitCode: null as number | null,
    once: vi.fn(),
    unref: vi.fn(),
    kill: vi.fn()
  }
  return { spawn: vi.fn(() => child), spawnedChild: child }
})

// `spawn` is overloaded per stdio shape and `spawnedChild` is deliberately not
// a whole ChildProcess, so the module shape is asserted here rather than grown
// into a full stub the assertions would not read.
vi.mock(import('node:child_process'), () => {
  const mocked = { spawn } as unknown as typeof childProcess
  return { default: mocked, spawn: mocked.spawn }
})
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

  // Nothing probes the offered port, so the copy must not call it free: under
  // --strictPort an occupied one fails the start, and an operator who was told
  // it was free reads that failure as a recorder bug rather than a taken port.
  it('offers the alternate port without claiming it is free', async () => {
    const distribution = customDistribution('https://nightly.example.com/')

    const thrown = await ensureDevServer(distribution, '/checkout').then(
      () => undefined,
      (caught: unknown) => caught
    )

    const { message } = thrownError(thrown)
    expect(message).not.toMatch(/free port/)
    expect(message).toContain('alternate port')
    expect(message).toContain('pick one you know is unused')
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
  beforeEach(() => {
    // `mockReset: true` clears implementations between tests, so the child is
    // re-attached here rather than only at vi.fn() creation.
    spawn.mockReturnValue(spawnedChild)
    spawnedChild.exitCode = null
    // Nothing is listening yet, so ensureDevServer starts its own; the poll
    // that follows finds it ready.
    vi.mocked(probeDevServer)
      .mockResolvedValueOnce({ status: 'not-running' })
      .mockResolvedValue({ status: 'ready' })
  })

  /**
   * ensureDevServer polls on a real setTimeout under the suite's fake timers,
   * so the run has to be driven past one interval before it can resolve.
   */
  async function startDevServer(...args: Parameters<typeof ensureDevServer>) {
    const pending = ensureDevServer(...args)
    await vi.advanceTimersByTimeAsync(1_000)
    return pending
  }

  // Vite walks upwards from :5173 when the port is taken, so an unpinned start
  // under COMFY_TEST_DEV_PORT produces a server the recorder never probes and
  // the run dies on the readiness timeout. This is the command the refusal
  // above tells the operator to run, so it has to land on the probed port.
  // Asserting the spawn call rather than the argv helper is what keeps the
  // cwd, the requested backend and the inherited Access variables covered: a
  // call site that stopped passing any of them would still leave a helper
  // assertion green.
  it('spawns the distribution script on the probed port, in the checkout', async () => {
    vi.stubEnv('COMFY_TEST_DEV_PORT', '5174')
    vi.stubEnv('DEV_SERVER_CF_ACCESS_CLIENT_ID', 'client-id.access')
    const distribution = customDistribution('https://nightly.example.com/')

    const server = await startDevServer(distribution, '/checkout')

    expect(server).toMatchObject({ ownedByUs: true, reused: false })
    expect(spawn).toHaveBeenCalledTimes(1)
    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      ['run', 'dev', '--port', '5174', '--strictPort'],
      expect.objectContaining({ cwd: '/checkout', detached: true })
    )
  })

  it('starts it against the requested backend, carrying the Access token', async () => {
    vi.stubEnv('DEV_SERVER_CF_ACCESS_CLIENT_ID', 'client-id.access')
    vi.stubEnv('DEV_SERVER_CF_ACCESS_CLIENT_SECRET', 'client-secret')
    const distribution = customDistribution('https://nightly.example.com/')

    await startDevServer(distribution, '/checkout')

    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      expect.anything(),
      expect.objectContaining({
        env: expect.objectContaining({
          DEV_SERVER_COMFYUI_URL: 'https://nightly.example.com/',
          DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access',
          DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret'
        })
      })
    )
  })

  it('pins the default port and the named script for a named distribution', async () => {
    const distribution = resolveDistribution('cloud')
    if (!distribution) throw new Error('cloud distribution is missing')

    await startDevServer(distribution, '/checkout')

    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      ['run', 'dev:cloud', '--port', '5173', '--strictPort'],
      expect.anything()
    )
  })
})
