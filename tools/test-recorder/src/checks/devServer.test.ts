import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checkDevServer } from './devServer'

const VITE_PAGE =
  '<html><script type="module" src="/@vite/client"></script></html>'

describe('checkDevServer', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    delete process.env.COMFY_TEST_DEV_PORT
    delete process.env.PLAYWRIGHT_TEST_URL
  })

  afterEach(() => {
    delete process.env.COMFY_TEST_DEV_PORT
    delete process.env.PLAYWRIGHT_TEST_URL
  })

  function stubFetch(handler: (url: string) => Response | Promise<Response>) {
    vi.stubGlobal('fetch', (input: string | URL) =>
      Promise.resolve(handler(String(input)))
    )
  }

  it('fails when nothing answers', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('ECONNREFUSED')))
    const result = await checkDevServer()
    expect(result.ok).toBe(false)
    expect(result.installInstructions?.join(' ')).toContain('pnpm dev')
  })

  it('fails when the responder is not Vite, which cannot serve local changes', async () => {
    stubFetch(() => new Response('<html>a production build</html>'))
    const result = await checkDevServer()
    expect(result.ok).toBe(false)
    expect(result.installInstructions?.join(' ')).toContain('not the Vite')
  })

  it('passes when Vite answers and no checkout is given to compare', async () => {
    stubFetch(() => new Response(VITE_PAGE))
    expect((await checkDevServer()).ok).toBe(true)
  })

  // Vite answers 403 for /@fs paths outside its own root, which is how a
  // server started from another worktree is caught.
  it('fails when the server belongs to a different checkout', async () => {
    stubFetch((url) =>
      url.includes('/@fs')
        ? new Response('forbidden', { status: 403 })
        : new Response(VITE_PAGE)
    )
    const result = await checkDevServer(undefined, '/repo/mine')
    expect(result.ok).toBe(false)
    expect(result.installInstructions?.join(' ')).toContain('/repo/mine')
  })

  it('passes when the server serves this checkout', async () => {
    stubFetch((url) =>
      url.includes('/@fs') ? new Response('ok') : new Response(VITE_PAGE)
    )
    expect((await checkDevServer(undefined, '/repo/mine')).ok).toBe(true)
  })

  it('does not fail the check when the probe is inconclusive', async () => {
    stubFetch((url) =>
      url.includes('/@fs')
        ? new Response('boom', { status: 500 })
        : new Response(VITE_PAGE)
    )
    expect((await checkDevServer(undefined, '/repo/mine')).ok).toBe(true)
  })

  it('probes the url the recorder will actually use', async () => {
    process.env.PLAYWRIGHT_TEST_URL = 'http://127.0.0.1:4321'
    const seen: string[] = []
    vi.stubGlobal('fetch', (input: string | URL) => {
      seen.push(String(input))
      return Promise.resolve(new Response(VITE_PAGE))
    })
    await checkDevServer()
    expect(seen[0]).toBe('http://127.0.0.1:4321')
  })
})
