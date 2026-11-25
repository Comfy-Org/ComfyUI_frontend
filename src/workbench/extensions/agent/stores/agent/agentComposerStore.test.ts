import { getActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  getWorkspaceId,
  StorageKeys
} from '@/platform/workflow/persistence/base/storageKeys'

import { useAgentComposerStore } from './agentComposerStore'

describe('composer reference ownership', () => {
  it('does not let late pasted-name metadata overwrite a withdrawn gate-held draft', () => {
    const store = useAgentComposerStore()
    store.setSkillScope('scope')
    const reference = {
      kind: 'skill' as const,
      name: 'portrait',
      description: '',
      scope: 'scope',
      textOffset: 0,
      resolvePastedName: true as const
    }
    store.restorePrompt({ text: ' colors', references: [reference] })
    const snapshot = {
      prompt: store.prompt,
      attachments: []
    }
    const resolved = {
      text: ' colors',
      references: [
        { ...reference, description: 'Resolved', resolvePastedName: undefined }
      ]
    }
    const id = store.startGateHold('cm-1')
    store.resolveSkillMetadata(resolved)
    expect(store.prompt).toEqual({ text: '', references: [] })
    expect(store.cancelGateHold()?.clientMessageId).toBe('cm-1')
    store.releaseGateHold(id)
    store.restorePrompt(snapshot.prompt, snapshot.attachments)
    store.resolveSkillMetadata(resolved)
    expect(store.prompt.references[0]).toMatchObject({
      description: 'Resolved'
    })
  })

  it('invalidates the old-scope skill and undo history on scope change while preserving other references', () => {
    const store = useAgentComposerStore()
    store.setSkillScope('workspace-a')
    const skill = {
      kind: 'skill' as const,
      name: 'portrait',
      description: 'Use defaults',
      scope: 'workspace-a',
      textOffset: 0
    }
    const workflow = {
      kind: 'workflow' as const,
      id: 'workflow',
      name: 'Reference',
      textOffset: 0
    }
    store.restorePrompt({ text: 'Keep this', references: [skill, workflow] })
    const previous = store.prompt
    const epoch = store.promptEpoch
    store.setSkillScope('workspace-b')
    expect(store.prompt).toEqual({ text: 'Keep this', references: [workflow] })
    expect(store.promptEpoch).toBeGreaterThan(epoch)
    store.applyEditorPrompt(previous)
    expect(store.prompt).toEqual({ text: 'Keep this', references: [workflow] })
  })

  it('keeps held attachment previews when the draft is cleared', () => {
    const store = useAgentComposerStore()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const held = {
      id: 'held',
      name: 'held.png',
      ref: 'held.png',
      previewUrl: 'blob:held'
    }
    store.addAttachment(held)
    store.holdAssets(['held'])
    store.clearDraft()
    expect(revoke).not.toHaveBeenCalled()
    store.restorePrompt({ text: 'back', references: [] }, [held])
    expect(store.attachments).toEqual([held])
    revoke.mockRestore()
  })

  it('releases obsolete previews while retaining assets explicitly retained by an owner key', () => {
    const store = useAgentComposerStore()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const retained = {
      id: 'retained',
      name: 'retained.png',
      ref: 'retained.png',
      previewUrl: 'blob:retained'
    }
    store.addAttachment({
      id: 'old',
      name: 'old.png',
      ref: 'old.png',
      previewUrl: 'blob:old'
    })
    store.addAttachment(retained)
    store.retainAssets('pending:cm-1', ['old', 'retained'])
    const gateId = store.startGateHold('cm-1')
    store.restorePrompt({ text: 'New draft', references: [] }, [retained])
    store.releaseRetainedAssets('pending:cm-1')
    expect(store.cancelGateHold()?.clientMessageId).toBe('cm-1')
    expect(store.cancelGateHold()).toBeNull()
    store.releaseGateHold(gateId)
    store.releaseUnusedAssets()
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:old')
    expect(store.attachments).toEqual([retained])
    expect(store.draft).toBe('New draft')
    expect(store.referenceAttachment('old')).toBe(false)
    expect(store.referenceAttachment('retained')).toBe(true)
  })

  it('keeps every asset occurrence and updates all of them after upload', () => {
    const store = useAgentComposerStore()
    store.addAttachment({
      id: 'image',
      name: 'source.png',
      ref: '',
      uploading: true
    })
    store.referenceAttachment('image')
    store.referenceAttachment('image')
    const snapshot = store.prompt
    expect(snapshot.references).toHaveLength(2)

    store.updateAttachment('image', { ref: 'uploaded.png', uploading: false })
    store.applyEditorPrompt(snapshot)
    expect(store.prompt.references).toEqual(
      snapshot.references.map((reference) => ({
        ...reference,
        attachment: {
          id: 'image',
          name: 'source.png',
          ref: 'uploaded.png',
          uploading: false
        }
      }))
    )
    expect(store.attachments).toHaveLength(1)
  })

  it('updates a tray upload without reinserting its deleted inline mention', () => {
    const store = useAgentComposerStore()
    store.addAttachment({
      id: 'image',
      name: 'source.png',
      ref: '',
      uploading: true
    })
    store.referenceAttachment('image')
    const snapshot = store.prompt
    store.removeReference('asset:image')
    store.updateAttachment('image', { ref: 'uploaded.png', uploading: false })
    expect(store.prompt.references).toEqual([])
    expect(store.attachments).toEqual([
      { id: 'image', name: 'source.png', ref: 'uploaded.png', uploading: false }
    ])
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
    store.referenceAttachment('image')
    const snapshot = store.prompt
    store.removeAttachment('image')
    store.updateAttachment('image', { ref: 'too-late.png', uploading: false })
    store.applyEditorPrompt(snapshot)
    expect(store.attachments).toEqual([])
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:source')
  })

  it('retains included previews after inline deletion and unmount', () => {
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
    store.referenceAttachment('first')
    store.removeReference('asset:first')
    expect(revoke).not.toHaveBeenCalled()
    store.releaseUnusedAssets()
    expect(revoke).not.toHaveBeenCalled()
    expect(store.attachments.map(({ id }) => id)).toEqual(['first', 'second'])
    store.removeAttachment('first')
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:first')
  })

  it('releases excluded previews when replacing the tray and rejects late updates', () => {
    const store = useAgentComposerStore()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    store.addAttachment({
      id: 'old',
      name: 'old.png',
      ref: 'old.png',
      previewUrl: 'blob:old'
    })
    store.referenceAttachment('old')
    const oldPrompt = store.prompt
    store.replaceDraft({
      text: 'New draft',
      workflowReferences: [],
      attachments: [
        { id: 'new', name: 'new.png', ref: 'new.png', previewUrl: 'blob:new' }
      ]
    })
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:old')
    store.updateAttachment('old', { previewUrl: 'blob:late' })
    expect(revoke).toHaveBeenLastCalledWith('blob:late')
    store.applyEditorPrompt({ ...oldPrompt, text: 'Keep typing' })
    expect(store.prompt).toEqual({ text: 'Keep typing', references: [] })
    expect(store.attachments.map(({ id }) => id)).toEqual(['new'])
    expect(revoke).not.toHaveBeenCalledWith('blob:new')
  })

  it('retains included media until replacement/removal and rejects late object URLs', () => {
    const store = useAgentComposerStore()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    store.addAttachment({
      id: 'video',
      name: 'clip.mp4',
      ref: '',
      mediaUrl: 'blob:video'
    })
    store.referenceAttachment('video')
    store.removeReference('asset:video')
    store.releaseUnusedAssets()
    expect(revoke).not.toHaveBeenCalled()
    store.updateAttachment('video', { mediaUrl: '/clip.mp4', ref: 'clip.mp4' })
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:video')
    store.updateAttachment('video', { mediaUrl: 'blob:replacement' })
    store.removeAttachment('video')
    store.updateAttachment('video', { mediaUrl: 'blob:late' })
    expect(revoke.mock.calls).toEqual([
      ['blob:video'],
      ['blob:replacement'],
      ['blob:late']
    ])
    expect(store.attachments).toEqual([])
  })

  it('releases a shared blob only after both its image and media uses end', () => {
    const store = useAgentComposerStore()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    store.addAttachment({
      id: 'video',
      name: 'clip.mp4',
      ref: '',
      previewUrl: 'blob:shared',
      mediaUrl: 'blob:shared'
    })
    store.updateAttachment('video', { previewUrl: undefined })
    expect(revoke).not.toHaveBeenCalled()
    store.removeAttachment('video')
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:shared')
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

describe('composer draft presence', () => {
  type ComposerStore = ReturnType<typeof useAgentComposerStore>

  it.for([
    { draft: 'empty', fill: () => {}, expected: false },
    {
      draft: 'whitespace only',
      fill: (store: ComposerStore) => store.setText('  \n '),
      expected: false
    },
    {
      draft: 'text',
      fill: (store: ComposerStore) => store.setText('make it blue'),
      expected: true
    },
    {
      draft: 'an attachment',
      fill: (store: ComposerStore) =>
        store.addAttachment({ id: 'a-1', name: 'cat.png', ref: 'cat.png' }),
      expected: true
    },
    {
      draft: 'a node reference',
      fill: (store: ComposerStore) => {
        store.setNodeScope('workflow-A')
        store.setNodes([{ id: '1', title: 'KSampler' }])
      },
      expected: true
    },
    {
      draft: 'a workflow reference',
      fill: (store: ComposerStore) =>
        store.setWorkflowReferences([
          { id: 'wf-portrait', name: 'portrait', textOffset: 0 }
        ]),
      expected: true
    },
    {
      draft: 'a skill reference',
      fill: (store: ComposerStore) => {
        store.setSkillScope('workspace-a')
        store.restorePrompt({
          text: ' ',
          references: [
            {
              kind: 'skill',
              name: 'portrait',
              description: '',
              scope: 'workspace-a',
              textOffset: 0
            }
          ]
        })
      },
      expected: true
    }
  ])('reports $draft as a draft: $expected', ({ fill, expected }) => {
    const store = useAgentComposerStore()
    fill(store)
    expect(store.hasDraft).toBe(expected)
  })
})

describe('composer draft persistence (PM-2002)', () => {
  async function reloadPage() {
    await nextTick()
    const store = useAgentComposerStore()
    store.$dispose()
    delete getActivePinia()?.state.value[store.$id]
    return useAgentComposerStore()
  }

  it('does not restore a draft into a different chat', async () => {
    const store = useAgentComposerStore()
    store.trackDraftThread('thread-a')
    store.setText('Only for thread A')

    const otherChat = await reloadPage()
    otherChat.trackDraftThread('thread-b')
    expect(otherChat.hasDraft).toBe(false)
  })

  it('restores text and workflow references, dropping node references and attachments', async () => {
    const store = useAgentComposerStore()
    store.trackDraftThread('thread-a')
    store.setText('Use  as the style')
    store.setWorkflowReferences([
      { id: 'wf-portrait', name: 'portrait', textOffset: 4 }
    ])
    store.setNodeScope('tab-1')
    store.setNodes([{ id: '7', title: 'KSampler' }])
    store.addAttachment({ id: 'a-1', name: 'cat.png', ref: 'cat.png' })
    const text = store.draft

    const restored = await reloadPage()
    restored.trackDraftThread('thread-a')
    expect(restored.prompt).toEqual({
      text,
      references: [
        { kind: 'workflow', id: 'wf-portrait', name: 'portrait', textOffset: 4 }
      ]
    })
    expect(restored.attachments).toEqual([])
  })

  it.for([
    { threadId: null, text: null, workflowReferences: [] },
    { threadId: null, text: 'Hi', workflowReferences: null },
    { threadId: null, text: 'Hi', workflowReferences: [{ id: 'wf' }] },
    { threadId: null, text: 'Hi', workflowReferences: ['wf'] }
  ])(
    'discards a malformed saved draft %j and keeps the composer usable',
    async (saved) => {
      const key = StorageKeys.agentComposerDraft(getWorkspaceId())
      localStorage.setItem(key, JSON.stringify(saved))

      const store = useAgentComposerStore()
      expect(() => store.trackDraftThread(null)).not.toThrow()
      expect(store.hasDraft).toBe(false)
      await nextTick()
      expect(localStorage.getItem(key)).toBeNull()

      store.setText('Make it blue')
      expect(store.prompt).toEqual({ text: 'Make it blue', references: [] })
    }
  )

  it('restores an in-flight blank-chat send across reload and forgets it once accepted or cleared', async () => {
    const sent = useAgentComposerStore()
    sent.trackDraftThread(null)
    sent.setText('Make it blue')
    await nextTick()
    const id = sent.startGateHold('cm-1')
    sent.releaseGateHold(id)

    const reloadedDuringSend = await reloadPage()
    reloadedDuringSend.trackDraftThread(null)
    expect(reloadedDuringSend.draft).toBe('Make it blue')

    const acceptedId = reloadedDuringSend.startGateHold('cm-2')
    reloadedDuringSend.releaseGateHold(acceptedId)
    reloadedDuringSend.clearPendingSendDraft('cm-2')
    const afterAccept = await reloadPage()
    afterAccept.trackDraftThread(null)
    expect(afterAccept.hasDraft).toBe(false)

    afterAccept.setText('Make it red')
    await nextTick()
    afterAccept.clearDraft()
    const afterClear = await reloadPage()
    afterClear.trackDraftThread(null)
    expect(afterClear.hasDraft).toBe(false)
  })

  it('reconciles a reloaded in-flight thread send against hydrated history so it restores only when the server has no new copy', async () => {
    const sender = useAgentComposerStore()
    sender.trackDraftThread('thread-a')
    sender.setText('Repeat prompt')
    const gateId = sender.startGateHold('cm-1', undefined, {
      expectedText: 'Repeat prompt',
      knownTurnIds: ['turn-1']
    })
    sender.releaseGateHold(gateId)
    expect(sender.hasDraft).toBe(false)

    const acceptedReload = await reloadPage()
    acceptedReload.trackDraftThread('thread-a')
    expect(acceptedReload.hasDraft).toBe(false)
    acceptedReload.reconcilePendingSendDraft('thread-a', [
      { turnId: 'turn-1', text: 'Repeat prompt' },
      { turnId: 'turn-2', text: 'Repeat prompt' }
    ])
    expect(acceptedReload.hasDraft).toBe(false)

    const senderDropped = await reloadPage()
    senderDropped.trackDraftThread('thread-a')
    senderDropped.setText('Repeat prompt')
    senderDropped.startGateHold('cm-2', undefined, {
      expectedText: 'Repeat prompt',
      knownTurnIds: ['turn-1']
    })

    const droppedReload = await reloadPage()
    droppedReload.trackDraftThread('thread-a')
    expect(droppedReload.hasDraft).toBe(false)
    droppedReload.reconcilePendingSendDraft('thread-a', [
      { turnId: 'turn-1', text: 'Repeat prompt' }
    ])
    expect(droppedReload.draft).toBe('Repeat prompt')
  })

  it('matches a leading @workflow chip with preserved leading space and keeps in-flight backup when a follow-up draft is typed', async () => {
    const sender = useAgentComposerStore()
    sender.trackDraftThread('thread-a')
    sender.setText(' make it blue')
    sender.setWorkflowReferences([{ id: 'wf-1', name: 'Hero', textOffset: 0 }])
    const gateId = sender.startGateHold('cm-chip', undefined, {
      expectedText: ' make it blue',
      knownTurnIds: ['turn-1']
    })
    sender.releaseGateHold(gateId)

    sender.setText('Follow-up draft')
    await nextTick()
    sender.clearDraft()
    await nextTick()

    const reloaded = await reloadPage()
    reloaded.trackDraftThread('thread-a')
    reloaded.reconcilePendingSendDraft('thread-a', [
      { turnId: 'turn-1', text: 'Earlier' },
      { turnId: 'turn-2', text: '[Hero](workflow://wf-1) make it blue' }
    ])
    expect(reloaded.hasDraft).toBe(false)
  })

  it('rebinds adopted blank-chat pending send backups to the created thread so reload restores them', async () => {
    const first = useAgentComposerStore()
    first.trackDraftThread(null)
    first.holdPendingSendDraft('cm-failed', {
      text: 'Failed before thread creation',
      expectedText: 'Failed before thread creation',
      workflowReferences: []
    })

    first.rebindPendingSendDrafts(['cm-failed'], 'th-adopted', 'turn-accepted')

    const reloaded = await reloadPage()
    reloaded.trackDraftThread('th-adopted')
    reloaded.reconcilePendingSendDraft('th-adopted', [
      { turnId: 'turn-accepted', text: 'Accepted thread starter' }
    ])

    expect(reloaded.draft).toBe('Failed before thread creation')
  })

  it('keeps an unmatched reload backup in storage without re-offering it mid-session when a draft already exists', async () => {
    const first = useAgentComposerStore()
    first.trackDraftThread('thread-a')
    first.holdPendingSendDraft('cm-unmatched', {
      text: 'Recover me later',
      expectedText: 'Recover me later',
      workflowReferences: []
    })

    const reloaded = await reloadPage()
    reloaded.trackDraftThread('thread-a')
    reloaded.setText('User started typing')
    reloaded.reconcilePendingSendDraft('thread-a', [])

    expect(reloaded.draft).toBe('User started typing')

    reloaded.clearDraft()
    reloaded.reconcilePendingSendDraft('thread-a', [])
    expect(reloaded.hasDraft).toBe(false)

    const reloadedAgain = await reloadPage()
    reloadedAgain.trackDraftThread('thread-a')
    reloadedAgain.reconcilePendingSendDraft('thread-a', [])
    expect(reloadedAgain.draft).toBe('Recover me later')
  })

  it('removes only matched and restored reload backups while preserving older unmatched backups and other threads', async () => {
    const first = useAgentComposerStore()
    first.trackDraftThread('thread-b')
    first.holdPendingSendDraft('cm-other-thread', {
      text: 'Other thread prompt',
      expectedText: 'Other thread prompt',
      workflowReferences: []
    })
    first.trackDraftThread('thread-a')
    first.holdPendingSendDraft('cm-matched', {
      text: 'Persisted prompt',
      expectedText: 'Persisted prompt',
      workflowReferences: []
    })
    first.holdPendingSendDraft('cm-older-unmatched', {
      text: 'Older failed prompt',
      expectedText: 'Older failed prompt',
      workflowReferences: []
    })
    first.holdPendingSendDraft('cm-latest-unmatched', {
      text: 'Latest failed prompt',
      expectedText: 'Latest failed prompt',
      workflowReferences: []
    })

    const reloaded = await reloadPage()
    reloaded.trackDraftThread('thread-a')
    reloaded.reconcilePendingSendDraft('thread-a', [
      { turnId: 'turn-1', text: 'Persisted prompt' }
    ])
    expect(reloaded.draft).toBe('Latest failed prompt')

    reloaded.clearDraft()
    await nextTick()

    const reloadedAgain = await reloadPage()
    reloadedAgain.trackDraftThread('thread-a')
    reloadedAgain.reconcilePendingSendDraft('thread-a', [
      { turnId: 'turn-1', text: 'Persisted prompt' }
    ])
    expect(reloadedAgain.draft).toBe('Older failed prompt')

    reloadedAgain.clearDraft()
    await nextTick()

    const reloadedAfterMatchedRemoved = await reloadPage()
    reloadedAfterMatchedRemoved.trackDraftThread('thread-a')
    reloadedAfterMatchedRemoved.reconcilePendingSendDraft('thread-a', [])
    expect(reloadedAfterMatchedRemoved.hasDraft).toBe(false)

    const reloadedOtherThread = await reloadPage()
    reloadedOtherThread.trackDraftThread('thread-b')
    reloadedOtherThread.reconcilePendingSendDraft('thread-b', [])
    expect(reloadedOtherThread.draft).toBe('Other thread prompt')
  })

  it('keeps unrestored blank-chat reload backups in storage when a draft exists or multiple backups are saved', async () => {
    const first = useAgentComposerStore()
    first.trackDraftThread(null)
    first.holdPendingSendDraft('cm-blank-1', {
      text: 'Earlier blank prompt',
      expectedText: 'Earlier blank prompt',
      workflowReferences: []
    })
    first.holdPendingSendDraft('cm-blank-2', {
      text: 'Latest blank prompt',
      expectedText: 'Latest blank prompt',
      workflowReferences: []
    })
    first.setText('Typed draft')

    const reloadedWithDraft = await reloadPage()
    reloadedWithDraft.trackDraftThread(null)
    expect(reloadedWithDraft.draft).toBe('Typed draft')

    reloadedWithDraft.clearDraft()
    await nextTick()

    const reloadedFirst = await reloadPage()
    reloadedFirst.trackDraftThread(null)
    expect(reloadedFirst.draft).toBe('Latest blank prompt')

    reloadedFirst.clearDraft()
    await nextTick()

    const reloadedSecond = await reloadPage()
    reloadedSecond.trackDraftThread(null)
    expect(reloadedSecond.draft).toBe('Earlier blank prompt')
  })

  it('batch-rebinds multiple adopted blank-chat backups and preserves each across reload even when text matches the starter', async () => {
    const first = useAgentComposerStore()
    first.trackDraftThread(null)
    first.holdPendingSendDraft('cm-fail-1', {
      text: 'Accepted thread starter',
      expectedText: 'Accepted thread starter',
      workflowReferences: []
    })
    first.holdPendingSendDraft('cm-fail-2', {
      text: 'Second failed prompt',
      expectedText: 'Second failed prompt',
      workflowReferences: []
    })

    first.rebindPendingSendDrafts(
      ['cm-fail-1', 'cm-fail-2'],
      'th-adopted',
      'turn-accepted'
    )

    const reloaded = await reloadPage()
    reloaded.trackDraftThread('th-adopted')
    reloaded.reconcilePendingSendDraft('th-adopted', [
      { turnId: 'turn-accepted', text: 'Accepted thread starter' }
    ])
    expect(reloaded.draft).toBe('Second failed prompt')

    reloaded.clearDraft()
    await nextTick()

    const reloadedSecond = await reloadPage()
    reloadedSecond.trackDraftThread('th-adopted')
    reloadedSecond.reconcilePendingSendDraft('th-adopted', [
      { turnId: 'turn-accepted', text: 'Accepted thread starter' }
    ])
    expect(reloadedSecond.draft).toBe('Accepted thread starter')
  })

  it('transfers pending send backups to a retried clientMessageId and threadId', async () => {
    const first = useAgentComposerStore()
    first.trackDraftThread(null)
    first.holdPendingSendDraft('cm-old', {
      text: 'Retried message',
      expectedText: 'Retried message',
      workflowReferences: []
    })

    first.transferPendingSendDraft('cm-old', 'cm-new', 'th-retried')
    first.clearPendingSendDraft('cm-old')

    const reloaded = await reloadPage()
    reloaded.trackDraftThread('th-retried')
    reloaded.reconcilePendingSendDraft('th-retried', [])

    expect(reloaded.draft).toBe('Retried message')
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

    store.startGateHold('cm-1')

    expect(store.promptOrigin).toBe('typed')
  })

  it('restores the prompt origin when a withdrawn gate hold returns the draft', () => {
    const store = useAgentComposerStore()
    store.setText('Upscale this image')
    store.markSuggestedPrompt()
    store.startGateHold('cm-1')
    store.cancelGateHold()
    store.restoreSubmissionMeta('suggestion', null)

    expect(store.promptOrigin).toBe('suggestion')
  })

  it('carries the clicked chip beside the origin, and drops it at the same moment', () => {
    const store = useAgentComposerStore()
    expect(store.starterPrompt).toBeNull()
    store.markSuggestedPrompt({ id: 'slot_3', clickId: 'click-1' })
    expect(store.starterPrompt).toEqual({
      id: 'slot_3',
      clickId: 'click-1'
    })

    // A reword is still that chip's message.
    store.setText('find me an upscaler, but for hands')
    expect(store.starterPrompt).toEqual({
      id: 'slot_3',
      clickId: 'click-1'
    })

    store.startGateHold('cm-1')

    expect(store.promptOrigin).toBe('typed')
    expect(store.starterPrompt).toBeNull()
  })

  it('drops click attribution when an editor update fully removes the prompt', () => {
    const store = useAgentComposerStore()
    store.setText('Find an upscaling workflow')
    store.markSuggestedPrompt({ id: 'slot_3', clickId: 'click-1' })

    store.applyEditorPrompt({ text: '', references: [] })

    expect(store.promptOrigin).toBe('typed')
    expect(store.starterPrompt).toBeNull()
  })

  it('keeps click attribution when an editor update rewords the prompt', () => {
    const store = useAgentComposerStore()
    store.setText('Find an upscaling workflow')
    store.markSuggestedPrompt({ id: 'slot_3', clickId: 'click-1' })

    store.applyEditorPrompt({
      text: 'Find an upscaling workflow for portraits',
      references: []
    })

    expect(store.promptOrigin).toBe('suggestion')
    expect(store.starterPrompt).toEqual({
      id: 'slot_3',
      clickId: 'click-1'
    })
  })

  it('drops the chip when the prompt is reopened through the edit action instead', () => {
    const store = useAgentComposerStore()
    store.markSuggestedPrompt({ id: 'slot_3', clickId: 'click-1' })

    store.replacePrompt({ text: 'the earlier prompt', workflowReferences: [] })

    expect(store.promptOrigin).toBe('edited')
    expect(store.starterPrompt).toBeNull()
  })

  it('leaves the origin typed after a gate hold clears when the user writes something new', () => {
    const store = useAgentComposerStore()
    store.markSuggestedPrompt()
    store.startGateHold('cm-1')
    store.setText('never mind, do this instead')

    expect(store.promptOrigin).toBe('typed')
  })
})
