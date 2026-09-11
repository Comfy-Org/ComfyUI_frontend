import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, shallowRef } from 'vue'
import type { EffectScope } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentDraftSubmission } from './useAgentDraftSubmission'
import { useCanvasSelection } from './useCanvasSelection'

const scopes: EffectScope[] = []
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
})

function setup() {
  const scope = effectScope()
  scopes.push(scope)
  const fixture = scope.run(() => {
    const composer = useAgentComposerStore()
    composer.replaceDraft({
      text: '  Compare these  ',
      attachments: [
        {
          id: 'upload-1',
          name: 'cat.png',
          ref: 'uploaded-cat',
          previewUrl: 'blob:cat'
        }
      ],
      workflowReferences: [
        { id: 'wf-reference', name: 'Lighting', textOffset: 0 }
      ]
    })
    const target = shallowRef<ComfyWorkflow | null>(
      createMockLoadedWorkflow({ path: 'workflows/target.json' })
    )
    const nodeWorkflow = shallowRef(target.value)
    const editableWorkflowId = ref<string | undefined>('wf-target')
    const canSubmit = ref(true)
    const selection = useCanvasSelection({
      selection: [],
      isLive: true,
      isTracking: false
    })
    selection.replace([{ id: '12', title: 'KSampler' }])
    const original = {
      draft: composer.draft,
      attachments: [...composer.attachments],
      references: [...composer.workflowReferences],
      nodes: [...selection.staged.value]
    }
    let resolveSend: (sent: boolean) => void = () => {}
    const promise = new Promise<boolean>((resolve) => {
      resolveSend = resolve
    })
    const pending = { promise, resolve: resolveSend }
    const send = vi.fn(() => pending.promise)
    const options = {
      canSubmit: () => canSubmit.value,
      target: () => target.value,
      editableWorkflowId: () => editableWorkflowId.value,
      selection: {
        ...selection,
        workflow: () => nodeWorkflow.value,
        exit: () => {}
      },
      send,
      stop: vi.fn(async () => {})
    }
    let submission = useAgentDraftSubmission(options)
    let mountedScope = scope
    return {
      composer,
      selection,
      original,
      target,
      nodeWorkflow,
      editableWorkflowId,
      canSubmit,
      pending,
      send,
      unmount() {
        mountedScope.stop()
      },
      remount() {
        mountedScope.stop()
        mountedScope = effectScope()
        scopes.push(mountedScope)
        mountedScope.run(() => {
          submission = useAgentDraftSubmission(options)
        })
      },
      submit() {
        return submission.submit(
          composer.draft.trim(),
          composer.attachments,
          composer.workflowReferences
        )
      }
    }
  })
  if (!fixture) throw new Error('Draft submission scope did not run')
  return fixture
}

describe('Agent draft submission', () => {
  it('clears the complete draft before sending its snapshot and preserves subsequent typing on success', async () => {
    const { composer, selection, original, submit, send, pending } = setup()
    send.mockImplementation(() => {
      expect(composer.draft).toBe('')
      expect(composer.attachments).toEqual([])
      expect(composer.workflowReferences).toEqual([])
      expect(selection.staged.value).toEqual([])
      return pending.promise
    })
    const sending = submit()
    expect(send).toHaveBeenCalledWith(
      'Compare these',
      original.attachments,
      original.nodes,
      original.references
    )
    composer.setText('Next prompt')
    pending.resolve(true)
    await sending
    expect(composer.draft).toBe('Next prompt')
  })

  it.for(['blocked', 'no-target', 'empty', 'uploading'])(
    'preserves the draft when final admission rejects it: %s',
    async (reason) => {
      const { composer, selection, target, canSubmit, submit, send } = setup()
      if (reason === 'blocked') canSubmit.value = false
      if (reason === 'no-target') target.value = null
      if (reason === 'empty') {
        composer.replaceDraft({
          text: ' ',
          attachments: [],
          workflowReferences: composer.workflowReferences
        })
      }
      if (reason === 'uploading')
        composer.updateAttachment('upload-1', { uploading: true })
      const draft = composer.draft
      const attachments = [...composer.attachments]
      const references = [...composer.workflowReferences]
      const nodes = [...selection.staged.value]

      await submit()

      expect(send).not.toHaveBeenCalled()
      expect(composer.draft).toBe(draft)
      expect(composer.attachments).toEqual(attachments)
      expect(composer.workflowReferences).toEqual(references)
      expect(selection.staged.value).toEqual(nodes)
    }
  )

  it('restores an untouched draft with its original whitespace and previews after immediate failure', async () => {
    const { composer, selection, original, submit, send } = setup()
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    send.mockResolvedValue(false)

    await submit()

    expect(composer.draft).toBe(original.draft)
    expect(composer.attachments).toEqual(original.attachments)
    expect(composer.workflowReferences).toEqual(original.references)
    expect(selection.staged.value).toEqual(original.nodes)
    expect(revoke).not.toHaveBeenCalled()
  })

  it('does not recover over an edit that was subsequently cleared', async () => {
    const { composer, selection, submit, pending } = setup()
    const sending = submit()
    composer.setText('Changed my mind')
    composer.setText('')
    pending.resolve(false)
    await sending

    expect(composer.draft).toBe('')
    expect(composer.attachments).toEqual([])
    expect(composer.workflowReferences).toEqual([])
    expect(selection.staged.value).toEqual([])
  })

  it.for(['pending', 'failed'])(
    'keeps edits made while the panel is closed when the submission is %s',
    async (phase) => {
      const { composer, submit, pending, unmount, remount } = setup()
      const sending = submit()
      unmount()
      if (phase === 'failed') {
        pending.resolve(false)
        await sending
      }
      composer.setText('New input')
      composer.setText('')
      pending.resolve(false)
      await sending
      remount()

      expect(composer.draft).toBe('')
      expect(composer.workflowReferences).toEqual([])
      expect(composer.attachments).toEqual([])
    }
  )

  it('preserves a reference-only edit after reopening even when it is undone', async () => {
    const { composer, submit, pending, remount } = setup()
    const sending = submit()
    remount()
    composer.setWorkflowReferences([
      { id: 'wf-new', name: 'New reference', textOffset: 0 }
    ])
    composer.setWorkflowReferences([])
    pending.resolve(false)
    await sending

    expect(composer.draft).toBe('')
    expect(composer.workflowReferences).toEqual([])
  })

  it('does not submit twice while the original request is pending after reopening', async () => {
    const { composer, submit, send, pending, remount } = setup()
    const sending = submit()
    remount()
    composer.setText('Next prompt')
    await submit()
    expect(send).toHaveBeenCalledOnce()
    pending.resolve(true)
    await sending

    expect(composer.draft).toBe('Next prompt')
    expect(composer.workflowReferences).toEqual([])
    expect(composer.attachments).toEqual([])
  })

  it('ignores the older attempt when a new context has already submitted', async () => {
    const { composer, submit, send, pending, remount } = setup()
    const first = submit()
    remount()
    composer.invalidateSubmission()
    composer.setText('New chat draft')
    let resolveNext: (sent: boolean) => void = () => {}
    const next = new Promise<boolean>((resolve) => {
      resolveNext = resolve
    })
    send.mockImplementationOnce(() => next)
    const second = submit()
    pending.resolve(false)
    await first
    expect(composer.draft).toBe('')
    resolveNext(false)
    await second

    expect(composer.draft).toBe('New chat draft')
    composer.setText('')
    await nextTick()
    remount()
    expect(composer.draft).toBe('')
  })

  it('does not recover into a changed composer context', async () => {
    const { composer, selection, submit, pending } = setup()
    const sending = submit()
    composer.invalidateSubmission()
    pending.resolve(false)
    await sending

    expect(composer.draft).toBe('')
    expect(composer.attachments).toEqual([])
    expect(composer.workflowReferences).toEqual([])
    expect(selection.staged.value).toEqual([])
  })

  it('excludes the current target from recovered references and keeps old nodes out of the new target', async () => {
    const {
      composer,
      selection,
      original,
      target,
      editableWorkflowId,
      submit,
      pending
    } = setup()
    const sending = submit()
    target.value = createMockLoadedWorkflow({ path: 'workflows/lighting.json' })
    editableWorkflowId.value = 'wf-reference'
    pending.resolve(false)
    await sending

    expect(composer.draft).toBe(original.draft)
    expect(composer.attachments).toEqual(original.attachments)
    expect(composer.workflowReferences).toEqual([])
    expect(selection.staged.value).toEqual([])
  })

  it('does not submit or recover nodes associated with a different workflow', async () => {
    const { composer, selection, original, nodeWorkflow, submit, send } =
      setup()
    nodeWorkflow.value = createMockLoadedWorkflow({
      path: 'workflows/other.json'
    })
    send.mockResolvedValue(false)
    await submit()

    expect(send).toHaveBeenCalledWith(
      'Compare these',
      original.attachments,
      [],
      original.references
    )
    expect(composer.draft).toBe(original.draft)
    expect(selection.staged.value).toEqual([])
  })
})
