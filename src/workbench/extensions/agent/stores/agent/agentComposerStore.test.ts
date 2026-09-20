import { describe, expect, it, vi } from 'vitest'

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
