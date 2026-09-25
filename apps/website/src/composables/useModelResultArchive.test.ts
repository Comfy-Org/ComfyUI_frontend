import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type { RunOutput } from '../config/workshop-run'
import { saveModelResult } from '../lib/workshop/cinematic-studio/model-results'
import { useModelResultArchive } from './useModelResultArchive'

vi.mock(import('../lib/workshop/cinematic-studio/model-results'))
const identity = {
  id: 'attempt-one',
  name: 'Model name',
  modelSlug: 'model-slug',
  createdAt: 100
}
const output: RunOutput = {
  kind: 'image',
  url: 'https://example.com/result.png',
  fileName: 'result.png',
  nsfw: true
}
function setup() {
  const namespace = ref<string | undefined>('user/workspace')
  const scope = effectScope()
  const archive = scope.run(() => useModelResultArchive(() => namespace.value))!
  onTestFinished(() => scope.stop())
  return { archive, namespace, scope }
}
beforeEach(() => {
  vi.mocked(saveModelResult).mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(
      async () => new Response(new Blob(['result'], { type: 'image/png' }))
    )
  )
})

describe('native model result archiving', () => {
  it('archives every output modality as blobs but excludes response metadata and request data', async () => {
    const { archive } = setup()
    const ticket = archive.begin(identity)
    expect(archive.status.value).toBe('idle')
    expect(fetch).not.toHaveBeenCalled()
    const outputs: RunOutput[] = [
      'image',
      'video',
      'audio',
      '3d',
      'text',
      'other'
    ].map((kind) => ({ ...output, kind: kind as RunOutput['kind'] }))
    await archive.archive(ticket, [
      ...outputs,
      { ...output, purpose: 'response-metadata', text: 'private response' }
    ])
    expect(fetch).toHaveBeenCalledTimes(6)
    expect(saveModelResult).toHaveBeenCalledOnce()
    const [namespace, record] = vi.mocked(saveModelResult).mock.calls[0]
    expect(namespace).toBe('user/workspace')
    expect(Object.keys(record).sort()).toEqual([
      'createdAt',
      'id',
      'modelSlug',
      'name',
      'outputs'
    ])
    expect(record.outputs.map((item) => item.kind)).toEqual(
      outputs.map((item) => item.kind)
    )
    for (const item of record.outputs) {
      expect(Object.keys(item).sort()).toEqual([
        'blob',
        'fileName',
        'kind',
        'nsfw'
      ])
      expect(item.blob).toBeInstanceOf(Blob)
      expect(item.nsfw).toBe(true)
    }
    expect(archive.status.value).toBe('saved')
  })

  it('does not save metadata-only results or results without an account scope', async () => {
    const { archive, namespace } = setup()
    await archive.archive(archive.begin(identity), [
      { ...output, purpose: 'response-metadata' }
    ])
    namespace.value = undefined
    await archive.archive(archive.begin(identity), [output])
    expect(fetch).not.toHaveBeenCalled()
    expect(saveModelResult).not.toHaveBeenCalled()
    expect(archive.status.value).toBe('idle')
  })

  it.for(['fetch', 'storage'] as const)(
    'retries %s failure with the same identity without a generation request',
    async (failure) => {
      const { archive } = setup()
      if (failure === 'fetch')
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(null, { status: 403 })
        )
      else vi.mocked(saveModelResult).mockRejectedValueOnce(new Error('Quota'))
      const ticket = archive.begin(identity)
      await archive.archive(ticket, [output])
      expect(archive.status.value).toBe('error')
      await archive.retry()
      expect(archive.status.value).toBe('saved')
      expect(vi.mocked(saveModelResult).mock.calls.at(-1)?.[1]).toMatchObject(
        identity
      )
      for (const [url, options] of vi.mocked(fetch).mock.calls) {
        expect(url).toBe(output.url)
        expect(options?.method).toBeUndefined()
        expect(options?.credentials).toBe('omit')
      }
    }
  )

  it('writes an in-flight result only to its original scope and clears prior-account status and retries', async () => {
    const deferred = Promise.withResolvers<Response>()
    vi.mocked(fetch).mockReturnValueOnce(deferred.promise)
    const { archive, namespace } = setup()
    const saving = archive.archive(archive.begin(identity), [output])
    expect(archive.status.value).toBe('saving')
    namespace.value = 'other/workspace'
    expect(archive.status.value).toBe('idle')
    deferred.resolve(new Response(new Blob(['result'])))
    await saving
    expect(saveModelResult).toHaveBeenCalledWith(
      'user/workspace',
      expect.objectContaining({ id: identity.id })
    )
    expect(archive.status.value).toBe('idle')
    await archive.retry()
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('does not let an older failed save replace a newer successful status', async () => {
    const deferred = Promise.withResolvers<Response>()
    vi.mocked(fetch).mockReturnValueOnce(deferred.promise)
    const { archive } = setup()
    const first = archive.archive(archive.begin(identity), [output])
    await archive.archive(archive.begin({ ...identity, id: 'attempt-two' }), [
      output
    ])
    deferred.reject(new Error('Expired'))
    await first
    expect(archive.status.value).toBe('saved')
  })

  it('rejects executable URLs without fetching them', async () => {
    const { archive } = setup()
    await archive.archive(archive.begin(identity), [
      { ...output, url: 'javascript:alert(1)' }
    ])
    expect(archive.status.value).toBe('error')
    expect(fetch).not.toHaveBeenCalled()
    expect(saveModelResult).not.toHaveBeenCalled()
  })

  it('rejects oversized result sets and declared download sizes before storing', async () => {
    const { archive } = setup()
    await archive.archive(
      archive.begin(identity),
      Array.from({ length: 101 }, () => output)
    )
    expect(archive.status.value).toBe('error')
    expect(fetch).not.toHaveBeenCalled()
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('large', {
        headers: { 'Content-Length': String(513 * 1024 * 1024) }
      })
    )
    await archive.archive(archive.begin(identity), [output])
    expect(archive.status.value).toBe('error')
    expect(saveModelResult).not.toHaveBeenCalled()
  })
})
