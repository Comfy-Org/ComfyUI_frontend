import { describe, expect, it, vi } from 'vitest'

import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import { useAgentComposerStore } from './agentComposerStore'

describe('composer reference ownership', () => {
  it('updates detached uploads without attaching them until an explicit Undo', () => {
    const store = useAgentComposerStore()
    store.addAttachment({
      id: 'image',
      name: 'source.png',
      ref: '',
      uploading: true
    })
    const snapshot = store.prompt
    store.removeReference('asset:image')
    store.updateAttachment('image', { ref: 'uploaded.png', uploading: false })
    expect(store.attachments).toEqual([])
    store.applyEditorPrompt(snapshot)
    expect(store.attachments).toEqual([
      { id: 'image', name: 'source.png', ref: 'uploaded.png', uploading: false }
    ])
    expect(store.prompt.references).toHaveLength(1)
  })

  it('does not restore failed or expired uploads through stale editor history', () => {
    const store = useAgentComposerStore()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    store.addAttachment({
      id: 'image',
      name: 'source.png',
      ref: '',
      uploading: true,
      previewUrl: 'blob:source'
    })
    const snapshot = store.prompt
    store.removeAttachment('image')
    store.updateAttachment('image', { ref: 'too-late.png', uploading: false })
    store.applyEditorPrompt(snapshot)
    expect(store.attachments).toEqual([])
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:source')
  })

  it('retains previews for Undo, then releases only unused previews on unmount', () => {
    const store = useAgentComposerStore()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    store.addAttachment({
      id: 'first',
      name: 'first.png',
      ref: 'first.png',
      previewUrl: 'blob:first'
    })
    store.addAttachment({
      id: 'second',
      name: 'second.png',
      ref: 'second.png',
      previewUrl: 'blob:second'
    })
    store.removeReference('asset:first')
    expect(revoke).not.toHaveBeenCalled()
    store.releaseUnusedAssets()
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:first')
    expect(store.attachments.map(({ id }) => id)).toEqual(['second'])
  })

  it('rejects node history from a different target even when node IDs collide', () => {
    const store = useAgentComposerStore()
    store.setNodeScope('workflow-A')
    store.setNodes([{ id: '12', title: 'Source node' }])
    const snapshot = store.prompt
    const epoch = store.promptEpoch
    store.setNodeScope('workflow-B')
    expect(store.promptEpoch).toBeGreaterThan(epoch)
    store.applyEditorPrompt(snapshot)
    expect(store.nodes).toEqual([])
    store.setNodes([{ id: '12', title: 'Other node' }])
    expect(store.nodes).toEqual([{ id: '12', title: 'Other node' }])
  })

  it('keeps an edited workflow-reference draft when a late target restore changes scope', () => {
    const store = useAgentComposerStore()
    store.replacePrompt({
      text: 'Before  between  after',
      workflowReferences: [
        { id: 'wf-1', name: 'Unsaved Workflow', textOffset: 7 },
        { id: 'wf-2', name: 'Unsaved Workflow (2)', textOffset: 16 }
      ]
    })
    const epoch = store.promptEpoch
    const draft = store.prompt
    store.setNodeScope('workflows/Unsaved Workflow (3).json')
    expect(store.promptEpoch).toBe(epoch)
    expect(store.prompt).toEqual(draft)
  })
})

describe('composer draft reset (PM-1331)', () => {
  // insertComposerReference (composerPrompt.ts) pads an empty `prompt.text`
  // with a literal space on first insert. setNodes() now resets `text` to
  // `''` once the last reference is removed and the leftover text is
  // whitespace-only, so the draft reports empty again.
  it('clears the draft once the only node reference is removed from an empty composer', () => {
    const store = useAgentComposerStore()
    store.setNodeScope('workflow-A')
    store.setNodes([{ id: '1', title: 'KSampler' }])
    expect(store.draft).toBe(' ')

    store.setNodes([])

    expect(store.nodes).toEqual([])
    expect(store.draft).toBe('')
  })
})

describe('composer prompt origin (PM-1474 F11)', () => {
  it('starts out typed and stays typed while the user writes', () => {
    const store = useAgentComposerStore()

    expect(store.promptOrigin).toBe('typed')
    store.setText('make me a workflow')
    expect(store.promptOrigin).toBe('typed')
  })

  it('records a suggestion chip, and keeps it across a later reword', () => {
    const store = useAgentComposerStore()
    store.markSuggestedPrompt()
    expect(store.promptOrigin).toBe('suggestion')

    store.setText('upscale this image, but in anime style')

    expect(store.promptOrigin).toBe('suggestion')
  })

  it('records a prompt reopened through the conversation edit action', () => {
    const store = useAgentComposerStore()
    store.replacePrompt({ text: 'the earlier prompt', workflowReferences: [] })

    expect(store.promptOrigin).toBe('edited')
  })

  it('resets to typed once the message is on its way, so the next one is its own', () => {
    const store = useAgentComposerStore()
    store.markSuggestedPrompt()

    store.startSubmission({
      prompt: store.prompt,
      attachments: [],
      nodes: [],
      target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
    })

    expect(store.promptOrigin).toBe('typed')
  })

  it('gives the origin back when a failed send returns the draft to the composer', () => {
    const store = useAgentComposerStore()
    store.setText('Upscale this image')
    store.markSuggestedPrompt()
    const id = store.startSubmission({
      prompt: store.prompt,
      attachments: [],
      nodes: [],
      target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
    })
    store.settleSubmission(id, false)

    expect(store.takeFailedSubmission()).toBeDefined()

    expect(store.promptOrigin).toBe('suggestion')
  })

  it('carries the clicked chip beside the origin, and drops it at the same moment', () => {
    const store = useAgentComposerStore()
    expect(store.starterPrompt).toBeNull()
    store.markSuggestedPrompt({ id: 'find_workflow', clickId: 'click-1' })
    expect(store.starterPrompt).toEqual({
      id: 'find_workflow',
      clickId: 'click-1'
    })

    // A reword is still that chip's message.
    store.setText('find me an upscaler, but for hands')
    expect(store.starterPrompt).toEqual({
      id: 'find_workflow',
      clickId: 'click-1'
    })

    store.startSubmission({
      prompt: store.prompt,
      attachments: [],
      nodes: [],
      target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
    })

    expect(store.promptOrigin).toBe('typed')
    expect(store.starterPrompt).toBeNull()
  })

  it('gives the chip back with the origin when a failed send returns the draft', () => {
    const store = useAgentComposerStore()
    store.setText('Find the best workflow for skin upscaling')
    store.markSuggestedPrompt({ id: 'find_workflow', clickId: 'click-1' })
    const id = store.startSubmission({
      prompt: store.prompt,
      attachments: [],
      nodes: [],
      target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
    })
    store.settleSubmission(id, false)

    expect(store.takeFailedSubmission()).toBeDefined()

    expect(store.promptOrigin).toBe('suggestion')
    expect(store.starterPrompt).toEqual({
      id: 'find_workflow',
      clickId: 'click-1'
    })
  })

  it('drops the chip when the prompt is reopened through the edit action instead', () => {
    const store = useAgentComposerStore()
    store.markSuggestedPrompt({ id: 'find_workflow', clickId: 'click-1' })

    store.replacePrompt({ text: 'the earlier prompt', workflowReferences: [] })

    expect(store.promptOrigin).toBe('edited')
    expect(store.starterPrompt).toBeNull()
  })

  it('leaves the origin alone when the failed draft is too stale to restore', () => {
    const store = useAgentComposerStore()
    store.markSuggestedPrompt()
    const id = store.startSubmission({
      prompt: store.prompt,
      attachments: [],
      nodes: [],
      target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
    })
    store.settleSubmission(id, false)
    // The user has moved on and written something of their own since.
    store.setText('never mind, do this instead')

    expect(store.takeFailedSubmission()).toBeUndefined()

    expect(store.promptOrigin).toBe('typed')
  })
})
