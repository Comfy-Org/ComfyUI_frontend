import { describe, expect, it, vi } from 'vitest'

/**
 * Guards the network block installed by `vitest.setup.ts`.
 *
 * A real request from a unit test outlives the test that started it; when it
 * eventually fails, the error is logged after vitest has torn the environment
 * down and the run is failed by an unhandled rejection that no failing test
 * explains. Keep this covered so the guard cannot be dropped silently.
 */
describe('unit test network guard', () => {
  it('rejects absolute http requests instead of dialling out', async () => {
    await expect(fetch('https://example.com/thing')).rejects.toThrow(
      /Blocked a real network request/
    )
  })

  it('rejects relative requests, which resolve against the happy-dom origin', async () => {
    await expect(fetch('/api/system_stats')).rejects.toThrow(
      /http:\/\/localhost:3000\/api\/system_stats/
    )
  })

  it('rejects Request objects too', async () => {
    await expect(
      fetch(new Request('https://example.com/thing'))
    ).rejects.toThrow(/Blocked a real network request/)
  })

  it('lets a test stub its own fetch', async () => {
    const stub = vi.fn().mockResolvedValue(new Response('ok'))
    vi.stubGlobal('fetch', stub)

    await expect(fetch('https://example.com/thing')).resolves.toBeInstanceOf(
      Response
    )

    vi.unstubAllGlobals()
    await expect(fetch('https://example.com/thing')).rejects.toThrow(
      /Blocked a real network request/
    )
  })
})
