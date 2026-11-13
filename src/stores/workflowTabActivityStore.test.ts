import { describe, expect, it } from 'vitest'

import { useWorkflowTabActivityStore } from './workflowTabActivityStore'

describe('useWorkflowTabActivityStore', () => {
  it('spins every tab with a running turn and marks the ones awaiting approval', () => {
    const store = useWorkflowTabActivityStore()

    store.setAgentTurnTabs([
      { path: 'workflows/a.json', awaitingApproval: true },
      { path: 'workflows/b.json', awaitingApproval: false }
    ])

    expect([...store.editingPaths]).toEqual([
      'workflows/a.json',
      'workflows/b.json'
    ])
    expect([...store.awaitingApprovalPaths]).toEqual(['workflows/a.json'])

    store.setAgentTurnTabs([])
    expect(store.editingPaths.size).toBe(0)
    expect(store.awaitingApprovalPaths.size).toBe(0)
  })

  it('toggles the tab-creation flag', () => {
    const store = useWorkflowTabActivityStore()

    store.setCreating(true)
    expect(store.creatingTab).toBe(true)

    store.setCreating(false)
    expect(store.creatingTab).toBe(false)
  })

  it('collects modified paths until each one is seen', () => {
    const store = useWorkflowTabActivityStore()

    store.markModified('workflows/a.json')
    store.markModified('workflows/b.json')
    expect(store.unseenModifiedPaths.has('workflows/a.json')).toBe(true)

    store.markSeen('workflows/a.json')
    expect(store.unseenModifiedPaths.has('workflows/a.json')).toBe(false)
    expect(store.unseenModifiedPaths.has('workflows/b.json')).toBe(true)

    store.markSeen('workflows/never-marked.json')
    expect(store.unseenModifiedPaths.size).toBe(1)
  })

  it('prunes unseen dots for tabs that are no longer open', () => {
    const store = useWorkflowTabActivityStore()
    store.markModified('workflows/closed.json')
    store.markModified('workflows/open.json')

    store.pruneClosed(['workflows/open.json'])

    expect(store.unseenModifiedPaths.has('workflows/closed.json')).toBe(false)
    expect(store.unseenModifiedPaths.has('workflows/open.json')).toBe(true)
  })

  describe('chat status of a tab', () => {
    const path = 'workflows/a.json'

    it('is nothing for a tab without a chat', () => {
      expect(useWorkflowTabActivityStore().chatStatusFor(path)).toBeUndefined()
    })

    it('is "seen" for a tab that has a chat and nothing going on', () => {
      const store = useWorkflowTabActivityStore()
      store.setChatPaths([path])

      expect(store.chatStatusFor(path)).toBe('seen')
      expect(store.chatStatusFor('workflows/b.json')).toBeUndefined()
    })

    it('is "unseen" once a turn finished in the background, and "seen" again after the tab is seen', () => {
      const store = useWorkflowTabActivityStore()
      store.setChatPaths([path])
      store.markModified(path)
      expect(store.chatStatusFor(path)).toBe('unseen')

      store.markSeen(path)
      expect(store.chatStatusFor(path)).toBe('seen')
    })

    it('is "in-progress" while a turn runs and "waiting" while it needs an answer', () => {
      const store = useWorkflowTabActivityStore()
      store.setAgentTurnTabs([{ path, awaitingApproval: false }])
      expect(store.chatStatusFor(path)).toBe('in-progress')

      store.setAgentTurnTabs([{ path, awaitingApproval: true }])
      expect(store.chatStatusFor(path)).toBe('waiting')
    })

    it('reports a running turn even when the tab is not known to have a chat yet', () => {
      const store = useWorkflowTabActivityStore()
      store.setAgentTurnTabs([{ path, awaitingApproval: false }])

      expect(store.chatStatusFor(path)).toBe('in-progress')
    })

    it('reports the most urgent state: waiting, then in progress, then unseen, then seen', () => {
      const store = useWorkflowTabActivityStore()
      store.setChatPaths([path])
      store.markModified(path)
      store.setAgentTurnTabs([{ path, awaitingApproval: true }])
      expect(store.chatStatusFor(path)).toBe('waiting')

      store.setAgentTurnTabs([{ path, awaitingApproval: false }])
      expect(store.chatStatusFor(path)).toBe('in-progress')

      store.setAgentTurnTabs([])
      expect(store.chatStatusFor(path)).toBe('unseen')

      store.markSeen(path)
      expect(store.chatStatusFor(path)).toBe('seen')
    })

    it('replaces the set of tabs with a chat on every write', () => {
      const store = useWorkflowTabActivityStore()
      store.setChatPaths([path, 'workflows/b.json'])
      store.setChatPaths(['workflows/b.json'])

      expect(store.chatStatusFor(path)).toBeUndefined()
      expect(store.chatStatusFor('workflows/b.json')).toBe('seen')
    })

    it('drops tabs that are no longer open', () => {
      const store = useWorkflowTabActivityStore()
      store.setChatPaths([path, 'workflows/open.json'])

      store.pruneClosed(['workflows/open.json'])

      expect(store.chatStatusFor(path)).toBeUndefined()
      expect(store.chatStatusFor('workflows/open.json')).toBe('seen')
    })

    it('is cleared together with the rest of the agent activity', () => {
      const store = useWorkflowTabActivityStore()
      store.setChatPaths([path])

      store.clearAgentActivity()

      expect(store.chatStatusFor(path)).toBeUndefined()
    })
  })
})
