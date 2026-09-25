import { Blob } from 'node:buffer'
import { URL } from 'node:url'
import { render } from '@testing-library/vue'
import { IDBFactory } from 'fake-indexeddb'
import { Response } from 'undici'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { defineComponent, nextTick, ref, shallowRef } from 'vue'

import { listCreations } from '../lib/workshop/cinematic-studio/creations'
import type { Take } from '../lib/workshop/cinematic-studio/reel'
import { useCinematicLibrary } from './useCinematicLibrary'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('Blob', Blob)
  vi.stubGlobal('URL', URL)
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('pixels', {
          headers: { 'Content-Type': 'image/png' }
        })
    )
  )
})

const completed: Take = {
  id: 'take-1',
  shot: 1,
  letter: 'A',
  prompt: 'A harbor',
  modelSlug: 'image-model',
  aspect: '16:9',
  startedAt: 100,
  status: 'done',
  output: {
    kind: 'image',
    fileName: 'harbor.png',
    url: 'https://example.com/output.png',
    nsfw: false
  }
}

function mountLibrary() {
  const namespace = ref('account-a')
  const takes = shallowRef<readonly Take[]>([])
  let library: ReturnType<typeof useCinematicLibrary> | undefined
  const mounted = render(
    defineComponent({
      setup() {
        library = useCinematicLibrary(
          () => namespace.value,
          () => takes.value
        )
        return () => null
      }
    })
  )
  onTestFinished(mounted.unmount)
  assert.isDefined(library)
  return { library, namespace, takes, unmount: mounted.unmount }
}

describe('cinematic library lifecycle', () => {
  it('keeps a deleted completed take deleted when saving is retried', async () => {
    const { library, takes } = mountLibrary()
    takes.value = [completed]
    await expect.poll(() => library.items.value.length).toBe(1)
    await library.remove(completed.id)
    library.retry()
    await expect.poll(() => library.loading.value).toBe(false)
    expect(library.items.value).toEqual([])
    expect(await listCreations('account-a')).toEqual([])
  })

  it('discards an output fetch that finishes after the account changes', async () => {
    const pending = Promise.withResolvers<Response>()
    const fetchMedia = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', fetchMedia)
    const { library, namespace, takes } = mountLibrary()
    takes.value = [completed]
    await expect.poll(() => fetchMedia.mock.calls.length).toBe(1)
    takes.value = []
    namespace.value = 'account-b'
    await nextTick()
    pending.resolve(
      new Response('pixels', { headers: { 'Content-Type': 'image/png' } })
    )
    await pending.promise
    await expect.poll(() => library.loading.value).toBe(false)
    expect(await listCreations('account-a')).toEqual([])
    expect(await listCreations('account-b')).toEqual([])
    expect(library.items.value).toEqual([])
    expect(library.urls.value).toEqual({})
  })

  it('revokes previews on an account change', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const { library, namespace, takes } = mountLibrary()
    takes.value = [completed]
    await expect.poll(() => library.items.value.length).toBe(1)
    const url = library.urls.value[completed.id]
    takes.value = []
    namespace.value = 'account-b'
    await nextTick()
    expect(library.urls.value).toEqual({})
    expect(revoke).toHaveBeenCalledWith(url)
  })

  it('reports unavailable storage instead of presenting an empty saved library silently', () => {
    vi.stubGlobal('indexedDB', undefined)
    const { library } = mountLibrary()
    expect(library.available.value).toBe(false)
    expect(library.error.value).toBe(true)
  })
})
