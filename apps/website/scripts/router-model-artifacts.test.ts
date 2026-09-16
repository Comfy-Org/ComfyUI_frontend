import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  downloadArtifact,
  validateArtifact,
  validateMediaProbe
} from './router-model-artifacts'

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'router-artifact-'))
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('artifact verification', () => {
  it('downloads raw bytes without forwarding Router credentials', async () => {
    vi.stubEnv('COMFY_KEY', 'secret-comfy-key')
    vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
      if (new Headers(options.headers).has('authorization'))
        return new Response('Credential was exposed', { status: 403 })
      expect(options.credentials).toBe('omit')
      return new Response('actual bytes')
    })
    const path = join(directory, 'artifact.bin')
    const result = await downloadArtifact(
      'https://provider.example/signed-output',
      path,
      new AbortController().signal,
      100
    )
    expect(result.bytes).toBe(12)
    expect(await readFile(path, 'utf8')).toBe('actual bytes')
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects an HTML error page even when the MIME type says image', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response('<html>Expired</html>', {
          headers: { 'Content-Type': 'image/png' }
        })
    )
    await expect(
      validateArtifact(
        {
          kind: 'image',
          url: 'https://provider.example/fake.png',
          fileName: 'fake.png'
        },
        'image',
        join(directory, 'fake.png'),
        new AbortController().signal,
        1000
      )
    ).rejects.toThrow('Downloaded file is not the expected image')
  })

  it('bounds streamed downloads even without a content-length header', async () => {
    const cancelled = vi.fn()
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.enqueue(new Uint8Array(10))
            },
            cancel: cancelled
          })
        )
    )
    await expect(
      downloadArtifact(
        'https://provider.example/large',
        join(directory, 'large'),
        new AbortController().signal,
        15
      )
    ).rejects.toThrow('Artifact exceeds byte limit')
    expect(cancelled).toHaveBeenCalledOnce()
    expect((await readFile(join(directory, 'large'))).length).toBe(10)
  })

  it('stops reading an aborted download', async () => {
    const controller = new AbortController()
    controller.abort(new Error('Stop this case'))
    vi.stubGlobal('fetch', async () => new Response('bytes'))
    await expect(
      downloadArtifact(
        'https://provider.example/output',
        join(directory, 'cancelled'),
        controller.signal,
        100
      )
    ).rejects.toThrow('Stop this case')
  })

  it('requires the advertised stream and a positive playable duration', () => {
    const audio = {
      streams: [{ codec_type: 'audio', sample_rate: '48000', channels: 2 }],
      format: { duration: '2.5' }
    }
    expect(validateMediaProbe(audio, 'audio')).toMatchObject({
      durationSeconds: 2.5,
      channels: 2
    })
    expect(() => validateMediaProbe(audio, 'video')).toThrow('no video stream')
    expect(() =>
      validateMediaProbe({ ...audio, format: { duration: '0' } }, 'audio')
    ).toThrow('no positive media duration')
  })
})
