import { render, waitFor } from '@testing-library/vue'
import { IDBFactory } from 'fake-indexeddb'
import { File as NativeFile } from 'node:buffer'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import { readWorkshopDraft } from '../config/workshop-draft-storage'
import * as draftStorage from '../config/workshop-draft-storage'
import type {
  FieldSchema,
  FileValue,
  FormValues
} from '../config/workshop-playground'
import { runBeforeSignInLeave } from '../config/workshop-return'
import { useWorkflowFormDraft } from './useWorkflowFormDraft'

const slug = 'workflows/draft-test'
const alice = JSON.stringify(['alice', 'workspace-a'])
const bob = JSON.stringify(['bob', 'workspace-a'])
const schema: FieldSchema[] = [
  {
    kind: 'text',
    name: 'prompt',
    label: 'Prompt',
    required: true,
    multiline: true
  },
  {
    kind: 'text',
    name: 'image',
    label: 'Image',
    required: false,
    multiline: false,
    presentation: {
      label: 'Image',
      help: '',
      control: 'text-box',
      advanced: false,
      hidden: false,
      urlUpload: 'image'
    }
  }
]

function mountDraft(
  scope: string,
  initial: FormValues = { prompt: 'Page default' }
) {
  const values = ref<FormValues>(initial)
  const fields = ref(schema)
  let captured: ReturnType<typeof useWorkflowFormDraft> | undefined
  const view = render(
    defineComponent({
      setup() {
        const draft = useWorkflowFormDraft(
          slug,
          scope,
          fields,
          values,
          ref(false)
        )
        captured = draft
        return () =>
          h(
            'output',
            draft.pending.value
              ? 'pending'
              : draft.restoreFailed.value
                ? 'failed'
                : 'ready'
          )
      }
    })
  )
  assert.exists(captured)
  return { ...view, values, fields, draft: captured }
}

function selectedFile(bytes: string): FileValue {
  const file = new File([bytes], 'private-input.png', { type: 'image/png' })
  return {
    file,
    name: file.name,
    type: file.type,
    size: file.size,
    previewUrl: 'blob:private-preview'
  }
}

function restoredFile(values: FormValues): File {
  const selected = values.image
  if (
    !selected ||
    typeof selected !== 'object' ||
    Array.isArray(selected) ||
    !selected.file
  )
    throw new Error('Missing restored file')
  return selected.file
}

beforeEach(() => {
  vi.stubGlobal('File', NativeFile)
  vi.stubGlobal('indexedDB', new IDBFactory())
})

describe('workflow form drafts', () => {
  it('transfers an anonymous sign-in draft to the next account once', async () => {
    const anonymous = mountDraft('anonymous', { prompt: 'Anonymous work' })
    await runBeforeSignInLeave()
    anonymous.unmount()
    const owner = mountDraft(alice)
    await waitFor(() => expect(owner.draft.pending.value).toBe(false))
    expect(owner.draft.restoreFailed.value).toBe(false)
    expect(owner.values.value.prompt).toBe('Anonymous work')
    owner.unmount()
    const different = mountDraft(bob)
    expect(different.values.value.prompt).toBe('Page default')
    different.unmount()
    const returned = mountDraft(alice)
    await waitFor(() => expect(returned.draft.pending.value).toBe(false))
    expect(returned.values.value.prompt).toBe('Anonymous work')
  })

  it('does not transfer an anonymous draft without a sign-in departure', () => {
    const anonymous = mountDraft('anonymous', { prompt: 'Anonymous work' })
    anonymous.unmount()
    const owner = mountDraft(alice)
    expect(owner.values.value.prompt).toBe('Page default')
  })

  it.for([
    { name: 'expired', offset: 3_600_000 },
    { name: 'from a future clock', offset: -1 }
  ])('does not transfer a sign-in marker that is $name', async ({ offset }) => {
    const anonymous = mountDraft('anonymous', { prompt: 'Anonymous work' })
    await runBeforeSignInLeave()
    const departedAt = Date.now()
    anonymous.unmount()
    vi.setSystemTime(departedAt + offset)
    const owner = mountDraft(alice)
    expect(owner.values.value.prompt).toBe('Page default')
  })

  it.for([
    { name: 'another account', scope: bob },
    {
      name: 'another workspace',
      scope: JSON.stringify(['alice', 'workspace-b'])
    }
  ])('isolates saved input values from $name', ({ scope }) => {
    const owner = mountDraft(alice, { prompt: 'Alice workspace A' })
    owner.unmount()
    const different = mountDraft(scope)
    expect(different.values.value.prompt).toBe('Page default')
    different.values.value = { prompt: 'Different work' }
    different.unmount()
    const returned = mountDraft(alice)
    expect(returned.values.value.prompt).toBe('Alice workspace A')
  })

  it('keeps changed file bytes in IndexedDB across repeated refreshes and overrides old run media', async () => {
    const first = mountDraft(alice)
    await nextTick()
    const selected = selectedFile('private image bytes')
    first.values.value = { prompt: 'Current prompt', image: selected }
    await nextTick()
    await waitFor(() => expect(first.draft.pending.value).toBe(false))
    expect(first.draft.restoreFailed.value).toBe(false)
    const token = sessionStorage.getItem(
      `comfy-workshop-form:${slug}:${alice}:media`
    )
    assert.exists(token)
    const saved = await readWorkshopDraft(token, new AbortController().signal)
    expect(saved).toEqual({ image: selected.file })
    const valuesInSessionStorage = Array.from(
      { length: sessionStorage.length },
      (_, index) => sessionStorage.getItem(sessionStorage.key(index) ?? '')
    ).join('')
    expect(valuesInSessionStorage).not.toContain('private image bytes')
    expect(valuesInSessionStorage).not.toContain('private-input.png')
    expect(valuesInSessionStorage).not.toContain('blob:private-preview')
    first.unmount()
    const second = mountDraft(alice, {
      image: 'https://storage.googleapis.com/private/canonical-run-input'
    })
    await waitFor(() => expect(second.draft.pending.value).toBe(false))
    expect(second.draft.restoreFailed.value).toBe(false)
    expect(second.values.value.image).toMatchObject({
      file: selected.file,
      name: 'private-input.png'
    })
    second.unmount()
    const third = mountDraft(alice)
    await waitFor(() => expect(third.draft.pending.value).toBe(false))
    expect(third.draft.restoreFailed.value).toBe(false)
    expect(third.values.value.image).toMatchObject({
      file: selected.file,
      name: 'private-input.png'
    })
    expect(await restoredFile(third.values.value).text()).toBe(
      'private image bytes'
    )
    expect(
      sessionStorage.getItem(`comfy-workshop-form:${slug}:${alice}:media`)
    ).toBe(token)
  })

  it('deletes persisted media when the form no longer has media fields', async () => {
    const first = mountDraft(alice)
    await nextTick()
    const selected = selectedFile('private image bytes')
    first.values.value = { prompt: 'Current prompt', image: selected }
    await nextTick()
    await waitFor(() => expect(first.draft.pending.value).toBe(false))
    const mediaKey = `comfy-workshop-form:${slug}:${alice}:media`
    const token = sessionStorage.getItem(mediaKey)
    assert.exists(token)
    expect(
      await readWorkshopDraft(token, new AbortController().signal)
    ).toEqual({ image: selected.file })

    first.fields.value = schema.filter((field) => field.name !== 'image')
    await first.draft.stash()
    expect(first.draft.restoreFailed.value).toBe(false)
    expect(
      await readWorkshopDraft(token, new AbortController().signal)
    ).toBeUndefined()
    expect(sessionStorage.getItem(mediaKey)).toBeNull()

    first.unmount()
    const reloaded = mountDraft(alice)
    await waitFor(() => expect(reloaded.draft.pending.value).toBe(false))
    expect(reloaded.draft.restoreFailed.value).toBe(false)
    expect(reloaded.values.value.image).toBeUndefined()
    expect(reloaded.values.value.prompt).toBe('Current prompt')
  })

  it('retains the latest file when more edits arrive during a pending save', async () => {
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const store = draftStorage.storeWorkshopDraft
    vi.spyOn(draftStorage, 'storeWorkshopDraft').mockImplementationOnce(
      async (token, files, signal) => {
        started.resolve()
        await release.promise
        await store(token, files, signal)
      }
    )
    onTestFinished(() => release.resolve())
    const view = mountDraft(alice)
    await nextTick()
    view.values.value = { image: selectedFile('first') }
    await started.promise
    view.values.value = { image: selectedFile('second') }
    await nextTick()
    view.values.value = { image: selectedFile('latest') }
    await nextTick()
    release.resolve()
    await waitFor(() => expect(view.draft.pending.value).toBe(false))
    view.unmount()
    const restored = mountDraft(alice)
    await waitFor(() => expect(restored.draft.pending.value).toBe(false))
    expect(await restoredFile(restored.values.value).text()).toBe('latest')
  })

  it('keeps the selected file and reports an automatic draft save failure', async () => {
    const view = mountDraft(alice)
    await nextTick()
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new DOMException('Storage disabled', 'SecurityError')
    })
    const selected = selectedFile('unsaved private bytes')
    view.values.value = { prompt: 'Unsaved input', image: selected }
    await nextTick()
    await waitFor(() => expect(view.draft.pending.value).toBe(false))
    expect(view.draft.restoreFailed.value).toBe(true)
    expect(await restoredFile(view.values.value).text()).toBe(
      'unsaved private bytes'
    )
    expect(sessionStorage.getItem(`comfy-workshop-form:${slug}:${alice}`)).toBe(
      JSON.stringify({ prompt: 'Unsaved input' })
    )
  })
})
