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
})
