import { getActivePinia } from 'pinia'
import { assert, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  getWorkspaceId,
  StorageKeys
} from '@/platform/workflow/persistence/base/storageKeys'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import { useAgentComposerStore } from './agentComposerStore'

describe('composer reference ownership', () => {
  it('does not let late pasted-name metadata overwrite a submitted draft or invalidate failure recovery', () => {
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
      attachments: [],
      nodes: [],
      target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
    }
    const resolved = {
      text: ' colors',
      references: [
        { ...reference, description: 'Resolved', resolvePastedName: undefined }
      ]
    }
    const id = store.startSubmission(snapshot)
    store.resolveSkillMetadata(resolved)
    expect(store.prompt).toEqual({ text: '', references: [] })
    store.settleSubmission(id, false)
    const failed = store.takeFailedSubmission()
    expect(failed).toEqual(snapshot)
    assert.exists(failed)
    store.restorePrompt(failed.prompt, failed.attachments)
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

  it('releases invalidated snapshot previews while retaining the current tray and ignoring repeated invalidation and stale settlement', () => {
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
    const id = store.startSubmission({
      prompt: store.prompt,
      attachments: store.attachments,
      nodes: [],
      target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
    })
    store.restorePrompt({ text: 'New draft', references: [] }, [retained])
    store.invalidateSubmission()
    store.invalidateSubmission()
    store.settleSubmission(id, false)
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:old')
    expect(store.attachments).toEqual([retained])
    expect(store.draft).toBe('New draft')
    expect(store.takeFailedSubmission()).toBeUndefined()
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

describe('composer drafts per chat', () => {
  const catImage = {
    id: 'a-1',
    name: 'cat.png',
    ref: 'cat.png',
    previewUrl: 'blob:cat'
  }

  it('keeps the draft of the chat it leaves and gives it back when that chat is active again', () => {
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.setText('make it blue')

    store.activateDraft('blank:tab-b')
    expect(store.hasDraft).toBe(false)
    expect(store.draft).toBe('')

    store.activateDraft('thread:a')
    expect(store.draft).toBe('make it blue')
  })

  it('gives text typed before any chat was active to the first chat', () => {
    const store = useAgentComposerStore()
    store.setText('typed first')

    store.activateDraft('thread:a')

    expect(store.draft).toBe('typed first')
  })

  it('does not keep a whitespace-only draft', () => {
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.setText('  \n ')

    store.activateDraft('thread:b')
    store.activateDraft('thread:a')

    expect(store.draft).toBe('')
    expect(store.hasDraft).toBe(false)
  })

  it('keeps workflow references with their place in the text', () => {
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.setText('Use  as the style')
    store.setWorkflowReferences([
      { id: 'wf-portrait', name: 'portrait', textOffset: 4 }
    ])

    store.activateDraft('thread:b')
    store.activateDraft('thread:a')

    expect(store.prompt).toEqual({
      text: 'Use  as the style',
      references: [
        { kind: 'workflow', id: 'wf-portrait', name: 'portrait', textOffset: 4 }
      ]
    })
  })

  it('keeps an error chip with its chat', () => {
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.setErrorContext({
      scope: 'card',
      count: 1,
      label: 'Execution failed',
      severity: 'error',
      problems: [{ category: 'execution_failure', message: 'boom' }]
    })

    store.activateDraft('thread:b')
    expect(store.errorContext).toBeNull()
    store.activateDraft('thread:a')

    expect(store.errorContext?.label).toBe('Execution failed')
    expect(store.promptOrigin).toBe('error_context')
  })

  it('drops node references, which belong to the canvas selection', () => {
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.setNodeScope('workflow-A')
    store.setNodes([{ id: '1', title: 'KSampler' }])
    store.setText(`${store.draft}make it blue`)
    expect(store.nodes).toHaveLength(1)

    store.activateDraft('thread:b')
    store.activateDraft('thread:a')

    expect(store.nodes).toEqual([])
    expect(store.draft).toContain('make it blue')
  })

  it('does not keep a draft that only held node references', () => {
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.setNodeScope('workflow-A')
    store.setNodes([{ id: '1', title: 'KSampler' }])

    store.activateDraft('thread:b')
    store.activateDraft('thread:a')

    expect(store.hasDraft).toBe(false)
    expect(store.draft).toBe('')
  })

  it('keeps the attachments of the chat it leaves and their previews until the draft is gone', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.addAttachment(catImage)

    store.activateDraft('thread:b')
    store.releaseUnusedAssets()
    expect(store.attachments).toEqual([])
    expect(revoke).not.toHaveBeenCalled()

    store.activateDraft('thread:a')
    expect(store.attachments).toEqual([catImage])
    expect(store.hasDraft).toBe(true)
  })

  it('lets a kept draft finish uploading while another chat is open', () => {
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.addAttachment({
      id: 'a-1',
      name: 'cat.png',
      ref: '',
      uploading: true
    })

    store.activateDraft('thread:b')
    store.updateAttachment('a-1', { ref: 'uploaded.png', uploading: false })
    expect(store.attachments).toEqual([])
    store.activateDraft('thread:a')

    expect(store.attachments).toEqual([
      { id: 'a-1', name: 'cat.png', ref: 'uploaded.png', uploading: false }
    ])
  })

  it('drops a file of a kept draft whose upload failed, and keeps the rest of the draft', () => {
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.setText('make it blue')
    store.addAttachment({
      id: 'a-1',
      name: 'cat.png',
      ref: '',
      uploading: true
    })

    store.activateDraft('thread:b')
    store.removeAttachment('a-1')
    store.activateDraft('thread:a')

    expect(store.attachments).toEqual([])
    expect(store.draft).toBe('make it blue')
  })

  it('keeps the draft with its chat when a blank chat becomes a thread', () => {
    const store = useAgentComposerStore()
    store.activateDraft('blank:tab-a')
    store.setText('typed while the first message was accepted')

    store.rekeyDraft('blank:tab-a', 'thread:new')
    store.activateDraft('thread:new')
    expect(store.draft).toBe('typed while the first message was accepted')

    store.activateDraft('blank:tab-a')
    expect(store.draft).toBe('')
    store.activateDraft('thread:new')
    expect(store.draft).toBe('typed while the first message was accepted')
  })

  it('discards the draft of a chat that is deleted, and releases its previews', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.setText('make it blue')
    store.addAttachment(catImage)
    store.activateDraft('thread:b')

    store.discardDraft('thread:a')

    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:cat')
    store.activateDraft('thread:a')
    expect(store.hasDraft).toBe(false)
  })

  it('clears the draft of the chat that is open when that chat is discarded', () => {
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.setText('make it blue')

    store.discardDraft('thread:a')

    expect(store.hasDraft).toBe(false)
  })

  it('keeps the drafts of the twenty most recently left chats', () => {
    const store = useAgentComposerStore()
    for (let chat = 0; chat <= 20; chat++) {
      store.activateDraft(`thread:${chat}`)
      store.setText(`draft ${chat}`)
    }
    store.activateDraft('thread:other')

    store.activateDraft('thread:0')
    expect(store.hasDraft).toBe(false)
    store.activateDraft('thread:1')
    expect(store.draft).toBe('draft 1')
    store.activateDraft('thread:20')
    expect(store.draft).toBe('draft 20')
  })

  it('does not bring a sent message back when its chat is active again', () => {
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.setText('make it blue')
    const id = store.startSubmission({
      prompt: store.prompt,
      attachments: [],
      nodes: [],
      target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
    })
    store.settleSubmission(id, true)

    store.activateDraft('thread:b')
    store.activateDraft('thread:a')

    expect(store.hasDraft).toBe(false)
  })

  it('keeps how a draft started, so a chip stays a chip', () => {
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.setText('Make it blue')
    store.markSuggestedPrompt()

    store.activateDraft('thread:b')
    expect(store.promptOrigin).toBe('typed')
    store.activateDraft('thread:a')

    expect(store.promptOrigin).toBe('suggestion')
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

  it('saves only the draft of the chat that is open', async () => {
    const store = useAgentComposerStore()
    store.activateDraft('thread:a')
    store.trackDraftThread('a')
    store.setText('only for a')
    store.activateDraft('thread:b')
    store.trackDraftThread('b')
    store.setText('only for b')

    const reloaded = await reloadPage()
    reloaded.trackDraftThread('a')

    expect(reloaded.hasDraft).toBe(false)
  })

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

  it('forgets the draft once it is sent or cleared', async () => {
    const sent = useAgentComposerStore()
    sent.trackDraftThread(null)
    sent.setText('Make it blue')
    await nextTick()
    const id = sent.startSubmission({
      prompt: sent.prompt,
      attachments: [],
      nodes: [],
      target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
    })
    sent.settleSubmission(id, true)
    const afterSend = await reloadPage()
    afterSend.trackDraftThread(null)
    expect(afterSend.hasDraft).toBe(false)

    afterSend.setText('Make it red')
    await nextTick()
    afterSend.clearDraft()
    const afterClear = await reloadPage()
    afterClear.trackDraftThread(null)
    expect(afterClear.hasDraft).toBe(false)
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

    store.startSubmission({
      prompt: store.prompt,
      attachments: [],
      nodes: [],
      target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
    })

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

  it('gives the chip back with the origin when a failed send returns the draft', () => {
    const store = useAgentComposerStore()
    store.setText('Find the best workflow for skin upscaling')
    store.markSuggestedPrompt({ id: 'slot_3', clickId: 'click-1' })
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
