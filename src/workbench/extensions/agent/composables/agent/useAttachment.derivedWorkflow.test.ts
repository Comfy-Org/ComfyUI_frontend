import { setImmediate } from 'node:timers/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { deriveWorkflowFile } from '@/workbench/extensions/agent/utils/derivedWorkflowAttachment'
import { MAX_TURN_ATTACHMENTS, useAttachment } from './useAttachment'

vi.mock(
  import('@/workbench/extensions/agent/utils/derivedWorkflowAttachment'),
  { spy: true }
)

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function workflowFile(name: string) {
  return new File(['{"nodes":[{"id":1,"type":"KSampler"}]}'], name, {
    type: 'application/json'
  })
}

function imageFile(name: string, lastModified = 1) {
  return new File(['image'], name, { type: 'image/png', lastModified })
}

function harness() {
  const store = useAgentComposerStore()
  const upload = vi.fn(async (file: File) => ({ ref: file.name }))
  const attachment = useAttachment({
    upload,
    staged: () => store.attachments,
    stage: store.addAttachment,
    update: store.updateAttachment,
    remove: store.removeAttachment
  })
  return { store, upload, ...attachment }
}

describe('useAttachment derived workflows', () => {
  beforeEach(() => {
    vi.mocked(deriveWorkflowFile).mockResolvedValue(undefined)
  })

  it('attaches the workflow as its own chip', async () => {
    vi.mocked(deriveWorkflowFile).mockResolvedValue(
      workflowFile('photo.workflow.json')
    )
    const { store, upload, addFiles } = harness()

    await addFiles([imageFile('photo.png')])
    await vi.waitUntil(
      () =>
        store.attachments.length === 2 &&
        store.attachments.every((chip) => !chip.uploading)
    )

    expect(store.attachments.map((chip) => chip.name)).toEqual([
      'photo.png',
      'photo.workflow.json'
    ])
    expect(upload).toHaveBeenCalledTimes(2)
    const workflowChip = store.attachments[1]
    expect(workflowChip.ref).toBe('photo.workflow.json')
  })

  it('leaves an image with no embedded workflow untouched', async () => {
    const { store, upload, addFiles } = harness()

    await addFiles([imageFile('plain.png')])

    expect(store.attachments.map((chip) => chip.name)).toEqual(['plain.png'])
    expect(upload).toHaveBeenCalledOnce()
  })

  it('does not lift a second copy when the same image is attached again', async () => {
    vi.mocked(deriveWorkflowFile).mockResolvedValue(
      workflowFile('photo.workflow.json')
    )
    const { store, addFiles, derivingWorkflow } = harness()

    await addFiles([imageFile('photo.png', 7)])
    await addFiles([imageFile('photo.png', 7)])
    await vi.waitUntil(() => !derivingWorkflow.value)
    await vi.waitUntil(() => store.attachments.every((chip) => !chip.uploading))

    expect(
      store.attachments.filter((chip) => chip.name === 'photo.workflow.json')
    ).toHaveLength(1)
  })

  it('never lets a derivation failure disturb the image', async () => {
    vi.mocked(deriveWorkflowFile).mockRejectedValue(
      new Error('parser exploded')
    )
    const { store, addFiles } = harness()

    await expect(addFiles([imageFile('photo.png')])).resolves.toBe(true)
    expect(store.attachments.map((chip) => chip.name)).toEqual(['photo.png'])
  })

  it('drops the lifted workflow silently when the turn is already full', async () => {
    const { store } = harness()
    const onError = vi.fn()
    const full = useAttachment({
      upload: async (file) => ({ ref: file.name }),
      onError,
      staged: () => store.attachments,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })

    vi.mocked(deriveWorkflowFile).mockResolvedValue(undefined)
    await full.addFiles(
      Array.from({ length: MAX_TURN_ATTACHMENTS - 1 }, (_, index) =>
        imageFile(`plain-${index}.png`, index)
      )
    )
    vi.mocked(deriveWorkflowFile).mockResolvedValue(
      workflowFile('photo.workflow.json')
    )
    await full.addFiles([imageFile('photo.png', 999)])
    await vi.waitUntil(() => !full.derivingWorkflow.value)

    expect(store.attachments).toHaveLength(MAX_TURN_ATTACHMENTS)
    expect(
      store.attachments.some((chip) => chip.name === 'photo.workflow.json')
    ).toBe(false)
    expect(onError).not.toHaveBeenCalled()
  })

  it('keeps the lifted workflow uploading until it lands, so a send cannot drop it', async () => {
    vi.mocked(deriveWorkflowFile).mockResolvedValue(
      workflowFile('photo.workflow.json')
    )
    const store = useAgentComposerStore()
    let releaseDerived: (() => void) | undefined
    const { addFiles } = useAttachment({
      upload: (file) =>
        file.name.endsWith('.workflow.json')
          ? new Promise((resolve) => {
              releaseDerived = () => resolve({ ref: file.name })
            })
          : Promise.resolve({ ref: file.name }),
      staged: () => store.attachments,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })

    await addFiles([imageFile('photo.png')])
    await vi.waitUntil(() => releaseDerived !== undefined)

    const derivedChip = store.attachments.find(
      (chip) => chip.name === 'photo.workflow.json'
    )
    expect(derivedChip?.uploading).toBe(true)

    releaseDerived?.()
    await vi.waitUntil(() => store.attachments.every((chip) => !chip.uploading))
  })

  it('removes the lifted workflow when its image is removed', async () => {
    vi.mocked(deriveWorkflowFile).mockResolvedValue(
      workflowFile('photo.workflow.json')
    )
    const { store, addFiles, cancelUpload } = harness()

    await addFiles([imageFile('photo.png')])
    await vi.waitUntil(
      () =>
        store.attachments.length === 2 &&
        store.attachments.every((chip) => !chip.uploading)
    )
    const imageId = store.attachments[0].id

    store.removeAttachment(imageId)
    cancelUpload(imageId)

    expect(store.attachments).toEqual([])
  })

  it('cancels a lifted workflow that has not finished uploading', async () => {
    vi.mocked(deriveWorkflowFile).mockResolvedValue(
      workflowFile('photo.workflow.json')
    )
    const store = useAgentComposerStore()
    const derivedStarted = deferred<void>()
    const derivedSettled = deferred<void>()
    const { addFiles, cancelAllUploads } = useAttachment({
      upload: async (file, signal) => {
        if (!file.name.endsWith('.workflow.json')) return { ref: file.name }
        try {
          return await new Promise<{ ref: string }>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), {
              once: true
            })
            derivedStarted.resolve()
          })
        } finally {
          derivedSettled.resolve()
        }
      },
      staged: () => store.attachments,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })

    await addFiles([imageFile('photo.png')])
    await derivedStarted.promise

    cancelAllUploads()
    await derivedSettled.promise
    await setImmediate()

    expect(
      store.attachments.some((chip) => chip.name === 'photo.workflow.json')
    ).toBe(false)
  })

  it('retires derivation state when the draft is replaced before a batch settles', async () => {
    vi.mocked(deriveWorkflowFile).mockResolvedValue(
      workflowFile('fast.workflow.json')
    )
    const sibling = deferred<{ ref: string }>()
    const store = useAgentComposerStore()
    const attachment = useAttachment({
      upload: async (file) =>
        file.name === 'slow.png' ? sibling.promise : { ref: file.name },
      staged: () => store.attachments,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })

    const batch = attachment.addFiles([
      imageFile('fast.png'),
      imageFile('slow.png')
    ])
    await vi.waitUntil(() =>
      store.attachments.some((chip) => chip.ref === 'fast.png')
    )
    const source = store.attachments.find((chip) => chip.ref === 'fast.png')
    assert.exists(source)
    const sourceStillBlocksSend = attachment.derivingWorkflow.value
    store.clearDraft()
    store.setText('Fresh draft')
    sibling.resolve({ ref: 'slow.png' })
    await batch
    await setImmediate()
    store.restorePrompt({ text: 'Restored', references: [] }, [source])

    expect(store.draft).toBe('Restored')
    expect(store.attachments).toHaveLength(1)
    expect(sourceStillBlocksSend).toBe(true)
    expect(attachment.derivingWorkflow.value).toBe(false)
  })

  it('discards a buffered derivation result when its source is removed before the batch settles', async () => {
    const slow = deferred<File | undefined>()
    vi.mocked(deriveWorkflowFile)
      .mockResolvedValueOnce(workflowFile('fast.workflow.json'))
      .mockReturnValueOnce(slow.promise)
    const { store, addFiles, cancelUpload } = harness()

    const batch = addFiles([imageFile('fast.png'), imageFile('slow.png')])
    await vi.waitUntil(
      () => vi.mocked(deriveWorkflowFile).mock.calls.length > 1
    )

    const fastId = store.attachments.find((chip) => chip.ref === 'fast.png')?.id
    assert.exists(fastId)
    store.removeAttachment(fastId)
    cancelUpload(fastId)

    slow.resolve(undefined)
    await batch
    await setImmediate()

    expect(
      store.attachments.some((chip) => chip.name === 'fast.workflow.json')
    ).toBe(false)
  })

  it('releases canceled extraction without admitting its late result to a fresh draft', async () => {
    const extraction = deferred<File | undefined>()
    vi.mocked(deriveWorkflowFile).mockReturnValue(extraction.promise)
    const { store, addFiles, cancelAllUploads, derivingWorkflow } = harness()

    await addFiles([imageFile('photo.png')])
    expect(derivingWorkflow.value).toBe(true)
    cancelAllUploads()
    store.clearDraft()
    store.setText('Fresh draft')
    const canceledWorkBlocksSend = derivingWorkflow.value
    extraction.resolve(workflowFile('photo.workflow.json'))
    await extraction.promise
    await setImmediate()

    expect(canceledWorkBlocksSend).toBe(false)
    expect(store.draft).toBe('Fresh draft')
    expect(store.attachments).toEqual([])
  })

  it('removes an uploaded source when all work is canceled during extraction', async () => {
    const extraction = deferred<File | undefined>()
    vi.mocked(deriveWorkflowFile).mockReturnValue(extraction.promise)
    const { store, addFiles, cancelAllUploads } = harness()

    await addFiles([imageFile('photo.png')])
    expect(store.attachments.map(({ name }) => name)).toEqual(['photo.png'])

    cancelAllUploads()

    expect(store.attachments).toEqual([])
    extraction.resolve(workflowFile('photo.workflow.json'))
    await extraction.promise
    await setImmediate()
    expect(store.attachments).toEqual([])
  })

  it('rejects late extraction after its source draft is replaced', async () => {
    const extraction = deferred<File | undefined>()
    vi.mocked(deriveWorkflowFile).mockReturnValue(extraction.promise)
    const { store, addFiles, derivingWorkflow } = harness()

    await addFiles([imageFile('photo.png')])
    expect(derivingWorkflow.value).toBe(true)

    store.clearDraft()
    store.setText('Fresh draft')

    expect(derivingWorkflow.value).toBe(false)

    extraction.resolve(workflowFile('photo.workflow.json'))
    await extraction.promise
    await setImmediate()

    expect(store.draft).toBe('Fresh draft')
    expect(store.attachments).toEqual([])
  })

  it('keeps a failed generated upload silent without losing the image', async () => {
    vi.mocked(deriveWorkflowFile).mockResolvedValue(
      workflowFile('photo.workflow.json')
    )
    const store = useAgentComposerStore()
    const onError = vi.fn()
    const onUploaded = vi.fn()
    const attachment = useAttachment({
      upload: async (file) => {
        if (file.name.endsWith('.json')) throw new Error('upload rejected')
        return { ref: file.name }
      },
      onError,
      onUploaded,
      staged: () => store.attachments,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })

    await expect(attachment.addFiles([imageFile('photo.png')])).resolves.toBe(
      true
    )
    await vi.waitUntil(() => !attachment.derivingWorkflow.value)
    await vi.waitUntil(() => store.attachments.every((chip) => !chip.uploading))

    expect(store.attachments.map((chip) => chip.ref)).toEqual(['photo.png'])
    expect(onError).not.toHaveBeenCalled()
    expect(onUploaded).toHaveBeenCalledOnce()
  })

  it('silently drops an oversized workflow while retaining its smaller source', async () => {
    vi.mocked(deriveWorkflowFile).mockResolvedValue(
      workflowFile('photo.workflow.json')
    )
    const store = useAgentComposerStore()
    const onError = vi.fn()
    const attachment = useAttachment({
      upload: async (file) => ({ ref: file.name }),
      maxBytes: () => 8,
      onError,
      staged: () => store.attachments,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })

    await expect(attachment.addFiles([imageFile('photo.png')])).resolves.toBe(
      true
    )
    await vi.waitUntil(() => !attachment.derivingWorkflow.value)

    expect(store.attachments.map((chip) => chip.ref)).toEqual(['photo.png'])
    expect(onError).not.toHaveBeenCalled()
  })

  it('lifts a workflow from every image in a batch larger than the upload concurrency', async () => {
    vi.mocked(deriveWorkflowFile).mockImplementation(async (file) =>
      workflowFile(`${file.name}.workflow.json`)
    )
    const { store, addFiles } = harness()

    const batch = Array.from({ length: 5 }, (_, index) =>
      imageFile(`shot-${index}.png`, index)
    )
    await expect(addFiles(batch)).resolves.toBe(true)
    await vi.waitUntil(
      () =>
        store.attachments.length === 10 &&
        store.attachments.every((chip) => !chip.uploading)
    )

    expect(
      store.attachments.filter((chip) => chip.name.endsWith('.workflow.json'))
    ).toHaveLength(5)
  })

  it('keeps extraction sequential when another image is attached while the first is still being read', async () => {
    const first = deferred<File | undefined>()
    vi.mocked(deriveWorkflowFile)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(workflowFile('second.workflow.json'))
    const { store, addFiles } = harness()

    await addFiles([imageFile('first.png')])
    await vi.waitUntil(
      () => vi.mocked(deriveWorkflowFile).mock.calls.length > 0
    )
    await addFiles([imageFile('second.png')])
    const readsBeforeFirstSettled =
      vi.mocked(deriveWorkflowFile).mock.calls.length

    first.resolve(workflowFile('first.workflow.json'))
    await vi.waitUntil(
      () =>
        store.attachments.length === 4 &&
        store.attachments.every((chip) => !chip.uploading)
    )

    expect(readsBeforeFirstSettled).toBe(1)
    expect(store.attachments.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'first.png',
        'first.workflow.json',
        'second.png',
        'second.workflow.json'
      ])
    )
  })

  it('does not read an image removed while waiting for another extraction', async () => {
    const first = deferred<File | undefined>()
    vi.mocked(deriveWorkflowFile)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(workflowFile('removed.workflow.json'))
    const { store, addFiles, cancelUpload, derivingWorkflow } = harness()

    await addFiles([imageFile('first.png')])
    await vi.waitUntil(
      () => vi.mocked(deriveWorkflowFile).mock.calls.length > 0
    )
    await addFiles([imageFile('removed.png')])
    const removedId = store.attachments.find(
      (chip) => chip.name === 'removed.png'
    )?.id
    assert.exists(removedId)
    store.removeAttachment(removedId)
    cancelUpload(removedId)

    first.resolve(undefined)
    await vi.waitUntil(() => !derivingWorkflow.value)
    await setImmediate()

    expect(store.attachments.map(({ name }) => name)).toEqual(['first.png'])
    expect(
      vi.mocked(deriveWorkflowFile).mock.calls.map(([file]) => file.name)
    ).toEqual(['first.png'])
  })

  it('extracts workflows in source order even when uploads finish in reverse order', async () => {
    const first = deferred<File | undefined>()
    const second = deferred<File | undefined>()
    const firstUpload = deferred<{ ref: string }>()
    const secondUpload = deferred<{ ref: string }>()
    vi.mocked(deriveWorkflowFile)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { store, upload, addFiles } = harness()
    upload
      .mockReturnValueOnce(firstUpload.promise)
      .mockReturnValueOnce(secondUpload.promise)

    const adding = addFiles([imageFile('first.png'), imageFile('second.png')])
    secondUpload.resolve({ ref: 'second.png' })
    await vi.waitUntil(() => store.attachments[1].ref === 'second.png')
    firstUpload.resolve({ ref: 'first.png' })
    await adding
    await vi.waitUntil(
      () => vi.mocked(deriveWorkflowFile).mock.calls.length > 0
    )
    expect(
      vi.mocked(deriveWorkflowFile).mock.calls.map(([file]) => file.name)
    ).toEqual(['first.png'])

    first.resolve(workflowFile('first.workflow.json'))
    await vi.waitUntil(
      () => vi.mocked(deriveWorkflowFile).mock.calls.length > 1
    )
    expect(
      vi.mocked(deriveWorkflowFile).mock.calls.map(([file]) => file.name)
    ).toEqual(['first.png', 'second.png'])

    second.resolve(workflowFile('second.workflow.json'))
    await vi.waitUntil(() => store.attachments.length === 4)
    expect(store.attachments.map(({ name }) => name)).toEqual([
      'first.png',
      'second.png',
      'first.workflow.json',
      'second.workflow.json'
    ])
  })
})
