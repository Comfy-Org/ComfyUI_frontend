import { BufferSource } from 'mediabunny'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearVideoMetadataCache,
  extractVideoMetadata,
  fetchVideoMetadata,
  snapToStandardFrameRate
} from '@/utils/videoMetadataUtil'

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (path: string) => `http://localhost:8188/api${path}`
  }
}))

function bufferSource(bytes: Uint8Array) {
  return new BufferSource(bytes)
}

function readFixture(name: string): Uint8Array {
  return new Uint8Array(
    readFileSync(join(process.cwd(), 'src', 'utils', '__fixtures__', name))
  )
}

describe('extractVideoMetadata', () => {
  it('reads dimensions, duration, fps and size from an mp4', async () => {
    const bytes = readFixture('tiny.mp4')

    const result = await extractVideoMetadata(bufferSource(bytes))

    expect(result).toBeDefined()
    expect(result?.width).toBe(64)
    expect(result?.height).toBe(48)
    expect(result?.duration).toBeCloseTo(12 / 8, 1)
    expect(result?.fps).toBeCloseTo(8, 1)
    expect(result?.size).toBe(bytes.byteLength)
  })

  it('reads a webm container', async () => {
    const bytes = readFixture('tiny.webm')

    const result = await extractVideoMetadata(bufferSource(bytes))

    expect(result).toBeDefined()
    expect(result?.width).toBe(64)
    expect(result?.height).toBe(48)
    expect(result?.duration).toBeCloseTo(12 / 8, 1)
    expect(result?.fps).toBeCloseTo(8, 1)
  })

  it('returns undefined for non-video bytes', async () => {
    const bytes = new TextEncoder().encode('not actually a video file')

    const result = await extractVideoMetadata(bufferSource(bytes))

    expect(result).toBeUndefined()
  })

  it('returns undefined when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const result = await extractVideoMetadata(
      bufferSource(readFixture('tiny.mp4')),
      controller.signal
    )

    expect(result).toBeUndefined()
  })

  it('reports a null size when the source size is unknown', async () => {
    const source = bufferSource(readFixture('tiny.mp4'))
    source.getSizeOrNull = async () => null

    const result = await extractVideoMetadata(source)

    expect(result).toBeDefined()
    expect(result?.size).toBeNull()
    expect(result?.width).toBe(64)
  })
})

describe('snapToStandardFrameRate', () => {
  it('snaps near-standard measurements to the exact rate', () => {
    expect(snapToStandardFrameRate(29.972)).toBe(30_000 / 1_001)
    expect(snapToStandardFrameRate(23.98)).toBe(24_000 / 1_001)
    expect(snapToStandardFrameRate(30.005)).toBe(30)
    expect(snapToStandardFrameRate(59.945)).toBe(60_000 / 1_001)
  })

  it('leaves non-standard rates unchanged', () => {
    expect(snapToStandardFrameRate(8)).toBe(8)
    expect(snapToStandardFrameRate(33.3)).toBe(33.3)
  })
})

describe('fetchVideoMetadata url gating', () => {
  beforeEach(() => {
    clearVideoMetadataCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('extracts metadata from a trusted view url', async () => {
    const bytes = readFixture('tiny.mp4')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array(bytes).buffer))
    )

    const result = await fetchVideoMetadata(
      'http://localhost:8188/api/view?filename=tiny.mp4&type=input'
    )

    expect(result).toBeDefined()
    expect(result?.width).toBe(64)
    expect(result?.height).toBe(48)
    expect(result?.fps).toBeCloseTo(8, 1)
  })

  it('caches metadata per view resource ignoring cache-busting params', async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Uint8Array(readFixture('tiny.mp4')).buffer)
    )
    vi.stubGlobal('fetch', fetchMock)

    const first = await fetchVideoMetadata(
      'http://localhost:8188/api/view?filename=cached.mp4&type=input&rand=0.1'
    )
    const second = await fetchVideoMetadata(
      'http://localhost:8188/api/view?filename=cached.mp4&type=input&rand=0.2'
    )

    expect(first).toBeDefined()
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not share cache across different origins or paths', async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Uint8Array(readFixture('tiny.mp4')).buffer)
    )
    vi.stubGlobal('fetch', fetchMock)

    const fromApiBase = await fetchVideoMetadata(
      'http://localhost:8188/api/view?filename=origins.mp4&type=input'
    )
    const fromWindowOrigin = await fetchVideoMetadata(
      '/api/view?filename=origins.mp4&type=input'
    )

    expect(fromApiBase).toBeDefined()
    expect(fromWindowOrigin).toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent probes for the same resource', async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Uint8Array(readFixture('tiny.mp4')).buffer)
    )
    vi.stubGlobal('fetch', fetchMock)

    const url =
      'http://localhost:8188/api/view?filename=concurrent.mp4&type=input'
    const [first, second] = await Promise.all([
      fetchVideoMetadata(url),
      fetchVideoMetadata(url)
    ])

    expect(first).toBeDefined()
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('unblocks an aborted caller while the shared probe continues', async () => {
    let releaseFetch!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseFetch = resolve
    })
    const fetchMock = vi.fn(async () => {
      await gate
      return new Response(new Uint8Array(readFixture('tiny.mp4')).buffer)
    })
    vi.stubGlobal('fetch', fetchMock)

    const url = 'http://localhost:8188/api/view?filename=aborted.mp4&type=input'
    const controller = new AbortController()
    const pending = fetchVideoMetadata(url, controller.signal)
    controller.abort()

    expect(await pending).toBeUndefined()

    releaseFetch()
    const result = await fetchVideoMetadata(url)
    expect(result).toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache failed probes', async () => {
    const failing = vi.fn(async () => {
      throw new Error('network down')
    })
    vi.stubGlobal('fetch', failing)

    const url = 'http://localhost:8188/api/view?filename=flaky.mp4&type=input'
    expect(await fetchVideoMetadata(url)).toBeUndefined()

    const working = vi.fn(
      async () => new Response(new Uint8Array(readFixture('tiny.mp4')).buffer)
    )
    vi.stubGlobal('fetch', working)

    const result = await fetchVideoMetadata(url)
    expect(result).toBeDefined()
    expect(working).toHaveBeenCalled()
  })

  it('returns undefined for non-view urls', async () => {
    expect(await fetchVideoMetadata('blob:abc')).toBeUndefined()
    expect(
      await fetchVideoMetadata('http://localhost:8188/api/other?filename=a.mp4')
    ).toBeUndefined()
  })

  it('returns undefined for view urls without a filename', async () => {
    expect(
      await fetchVideoMetadata('http://localhost:8188/api/view?type=input')
    ).toBeUndefined()
  })

  it('rejects view urls from untrusted origins', async () => {
    expect(
      await fetchVideoMetadata('https://attacker.invalid/view?filename=a.mp4')
    ).toBeUndefined()
  })
})
