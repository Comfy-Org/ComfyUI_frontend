import { describe, expect, it, vi } from 'vitest'

describe.sequential('registered LiteGraph type cleanup', () => {
  it('tracks a singleton registered after a module reset', async () => {
    vi.resetModules()
    const { LGraphNode, LiteGraph } =
      await import('@/lib/litegraph/src/litegraph')
    LiteGraph.registerNodeType(
      'test/reset-module',
      class ResetModuleNode extends LGraphNode {}
    )
    expect(LiteGraph.registered_node_types['test/reset-module']).toBeDefined()
  })

  it('clears registrations from the new singleton', async () => {
    const { litegraph } = await import('@/lib/litegraph/src/litegraphInstance')
    expect(
      litegraph().registered_node_types['test/reset-module']
    ).toBeUndefined()
  })
})

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
      /\/api\/system_stats/
    )
  })

  it('rejects Request objects too', async () => {
    await expect(
      fetch(new Request('https://example.com/thing'))
    ).rejects.toThrow(/Blocked a real network request/)
  })

  it('rejects window.fetch, which code under test may reach for', async () => {
    await expect(window.fetch('https://example.com/thing')).rejects.toThrow(
      /Blocked a real network request/
    )
  })

  it('delegates non-http schemes to the real fetch', async () => {
    // The guard only blocks http(s). Anything else has to reach the original
    // fetch untouched - a `data:` URL round-tripping its body proves it did.
    const response = await fetch('data:text/plain,delegated')

    expect(await response.text()).toBe('delegated')
  })

  it('lets a test stub its own fetch', async () => {
    const stub = vi.fn().mockResolvedValue(new Response('ok'))
    vi.stubGlobal('fetch', stub)

    await expect(fetch('https://example.com/thing')).resolves.toBeInstanceOf(
      Response
    )
    await expect(
      window.fetch('https://example.com/thing')
    ).resolves.toBeInstanceOf(Response)

    // A test that stubs fetch owns restoring it. Unstubbing here proves the
    // guard is what sits underneath, rather than having been overwritten.
    vi.unstubAllGlobals()
    await expect(fetch('https://example.com/thing')).rejects.toThrow(
      /Blocked a real network request/
    )
  })

  it('errors a <script src> synchronously instead of fetching it', () => {
    // Subresource loads bypass the fetch guard: happy-dom fetches them
    // through its own pipeline. Disabled loading errors the element
    // synchronously; anything async means scripts reach the network again.
    const script = document.createElement('script')
    const events: string[] = []
    script.addEventListener('error', () => events.push('error'))
    script.addEventListener('load', () => events.push('load'))
    script.async = true
    script.src = 'https://example.com/external.js'
    document.head.appendChild(script)
    script.remove()

    expect(events).toEqual(['error'])
  })
})
