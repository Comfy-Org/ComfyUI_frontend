import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { deriveWorkflowFile } from '@/workbench/extensions/agent/utils/derivedWorkflowAttachment'
import { MAX_TURN_ATTACHMENTS, useAttachment } from './useAttachment'

vi.mock(
  import('@/workbench/extensions/agent/utils/derivedWorkflowAttachment'),
  { spy: true }
)

const mockDerive = vi.mocked(deriveWorkflowFile)

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
    mockDerive.mockResolvedValue(undefined)
  })

  it('attaches the workflow as its own chip', async () => {
    mockDerive.mockResolvedValue(workflowFile('photo.workflow.json'))
    const { store, upload, addFiles } = harness()

    await addFiles([imageFile('photo.png')])
    await vi.waitUntil(() => store.attachments.length === 2)

    expect(store.attachments.map((chip) => chip.name)).toEqual([
      'photo.png',
      'photo.workflow.json'
    ])
    expect(upload).toHaveBeenCalledTimes(2)
    const workflowChip = store.attachments[1]
    expect(workflowChip.ref).toBe('photo.workflow.json')
    expect(workflowChip.uploading).toBe(false)
    expect(workflowChip.sourceKey).toMatch(/^derived-workflow:/)
  })

  it('leaves an image with no embedded workflow untouched', async () => {
    const { store, upload, addFiles } = harness()

    await addFiles([imageFile('plain.png')])

    expect(store.attachments.map((chip) => chip.name)).toEqual(['plain.png'])
    expect(upload).toHaveBeenCalledOnce()
  })

  it('does not lift a second copy when the same image is attached again', async () => {
    mockDerive.mockResolvedValue(workflowFile('photo.workflow.json'))
    const { store, addFiles } = harness()

    await addFiles([imageFile('photo.png', 7)])
    await addFiles([imageFile('photo.png', 7)])

    expect(
      store.attachments.filter((chip) => chip.name === 'photo.workflow.json')
    ).toHaveLength(1)
  })

  it('never lets a derivation failure disturb the image', async () => {
    mockDerive.mockRejectedValue(new Error('parser exploded'))
    const { store, addFiles } = harness()

    await expect(addFiles([imageFile('photo.png')])).resolves.toBe(true)
    expect(store.attachments.map((chip) => chip.name)).toEqual(['photo.png'])
  })

  it('drops the lifted workflow silently when the turn is already full', async () => {
    mockDerive.mockResolvedValue(workflowFile('photo.workflow.json'))
    const { store } = harness()
    const onError = vi.fn()
    const full = useAttachment({
      upload: async (file: File) => ({ ref: file.name }),
      onError,
      staged: () => store.attachments,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })

    mockDerive.mockResolvedValue(undefined)
    await full.addFiles(
      Array.from({ length: MAX_TURN_ATTACHMENTS - 1 }, (_, index) =>
        imageFile(`plain-${index}.png`, index)
      )
    )
    mockDerive.mockResolvedValue(workflowFile('photo.workflow.json'))
    await full.addFiles([imageFile('photo.png', 999)])

    expect(store.attachments).toHaveLength(MAX_TURN_ATTACHMENTS)
    expect(
      store.attachments.some((chip) => chip.name === 'photo.workflow.json')
    ).toBe(false)
    expect(onError).not.toHaveBeenCalled()
  })

  it('keeps the lifted workflow uploading until it lands, so a send cannot drop it', async () => {
    mockDerive.mockResolvedValue(workflowFile('photo.workflow.json'))
    const store = useAgentComposerStore()
    let releaseDerived: (() => void) | undefined
    const { addFiles } = useAttachment({
      upload: (file: File) =>
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

  it('cancels a lifted workflow that has not finished uploading', async () => {
    mockDerive.mockResolvedValue(workflowFile('photo.workflow.json'))
    const store = useAgentComposerStore()
    const { addFiles, cancelAllUploads } = useAttachment({
      upload: (file: File) =>
        file.name.endsWith('.workflow.json')
          ? new Promise(() => {})
          : Promise.resolve({ ref: file.name }),
      staged: () => store.attachments,
      stage: store.addAttachment,
      update: store.updateAttachment,
      remove: store.removeAttachment
    })

    await addFiles([imageFile('photo.png')])
    await vi.waitUntil(() =>
      store.attachments.some((chip) => chip.name === 'photo.workflow.json')
    )

    cancelAllUploads()

    expect(
      store.attachments.some((chip) => chip.name === 'photo.workflow.json')
    ).toBe(false)
  })

  it('lifts a workflow from every image in a batch larger than the upload concurrency', async () => {
    mockDerive.mockImplementation(async (file: File) =>
      workflowFile(`${file.name}.workflow.json`)
    )
    const { store, addFiles } = harness()

    const batch = Array.from({ length: 5 }, (_, index) =>
      imageFile(`shot-${index}.png`, index)
    )
    await expect(addFiles(batch)).resolves.toBe(true)
    await vi.waitUntil(() => store.attachments.length === 10)

    expect(store.attachments).toHaveLength(10)
    expect(
      store.attachments.filter((chip) => chip.name.endsWith('.workflow.json'))
    ).toHaveLength(5)
  })
})
