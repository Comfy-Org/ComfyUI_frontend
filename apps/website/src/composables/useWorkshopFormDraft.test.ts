import { render, screen, waitFor } from '@testing-library/vue'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import * as storage from '../config/workshop-draft-storage'
import { workshopExampleFile } from '../config/workshop-example-file'
import type { FieldSchema, FormValues } from '../config/workshop-playground'
import { useWorkshopFormDraft } from './useWorkshopFormDraft'

const mediaKey = 'comfy-workshop-form:draft-test:media'
const original = 'https://example.com/current.webp'
const saved = 'https://example.com/saved.webp'
const schema: FieldSchema[] = [
  {
    name: 'image',
    label: 'Image',
    kind: 'file',
    accept: ['image/webp'],
    maxBytes: 1024,
    required: true
  }
]

function mountDraft() {
  const values = ref<FormValues>({ image: workshopExampleFile(original) })
  const view = render(
    defineComponent({
      setup() {
        const draft = useWorkshopFormDraft(
          'draft-test',
          ref(schema),
          values,
          ref(false),
          false
        )
        return () =>
          h(
            'output',
            draft.pending.value
              ? 'restoring'
              : draft.restoreFailed.value
                ? 'failed'
                : 'ready'
          )
      }
    })
  )
  return { ...view, values }
}

beforeEach(async () => {
  sessionStorage.clear()
  vi.stubGlobal('indexedDB', new IDBFactory())
  await storage.storeWorkshopDraft(
    'token',
    { image: saved },
    new AbortController().signal
  )
  sessionStorage.setItem(mediaKey, 'token')
})

describe('workshop draft restoration', () => {
  it('retains current inputs and the saved draft when a read fails, allowing reload to retry', async () => {
    vi.spyOn(storage, 'readWorkshopDraft').mockRejectedValueOnce(
      new Error('Read interrupted')
    )
    const first = mountDraft()
    await screen.findByText('failed')
    expect(first.values.value.image).toMatchObject({ sourceUrl: original })
    expect(sessionStorage.getItem(mediaKey)).toBe('token')
    first.unmount()

    const returned = mountDraft()
    await waitFor(() =>
      expect(returned.values.value.image).toMatchObject({ sourceUrl: saved })
    )
    await screen.findByText('ready')
    expect(sessionStorage.getItem(mediaKey)).toBeNull()
    expect(
      await storage.readWorkshopDraft('token', new AbortController().signal)
    ).toBeUndefined()
  })

  it('does not consume a draft when schema validation fails', async () => {
    await storage.storeWorkshopDraft(
      'token',
      { image: 'javascript:invalid' },
      new AbortController().signal
    )
    const view = mountDraft()
    await screen.findByText('failed')
    expect(view.values.value.image).toMatchObject({ sourceUrl: original })
    expect(sessionStorage.getItem(mediaKey)).toBe('token')
    expect(
      await storage.readWorkshopDraft('token', new AbortController().signal)
    ).toEqual({ image: 'javascript:invalid' })
  })

  it('retains the token and record when unmounted during restoration', async () => {
    const read = Promise.withResolvers<unknown>()
    vi.spyOn(storage, 'readWorkshopDraft').mockReturnValueOnce(read.promise)
    const view = mountDraft()
    await screen.findByText('restoring')
    view.unmount()
    read.resolve({ image: saved })
    await read.promise
    expect(view.values.value.image).toMatchObject({ sourceUrl: original })
    expect(sessionStorage.getItem(mediaKey)).toBe('token')
    expect(
      await storage.readWorkshopDraft('token', new AbortController().signal)
    ).toEqual({ image: saved })
  })
})
