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

    it('TS-01 is nothing for a tab without a chat', () => {
      expect(useWorkflowTabActivityStore().chatStatusFor(path)).toBeUndefined()
    })

    it('TS-02 is "seen" for a tab that has a chat and nothing going on', () => {
      const store = useWorkflowTabActivityStore()
      store.setChatPaths([path])

      expect(store.chatStatusFor(path)).toBe('seen')
      expect(store.chatStatusFor('workflows/b.json')).toBeUndefined()
    })

    it('TS-05 is "unseen" once a turn finished in the background, and "seen" again after the tab is seen', () => {
      const store = useWorkflowTabActivityStore()
      store.setChatPaths([path])
      store.markModified(path)
      expect(store.chatStatusFor(path)).toBe('unseen')

      store.markSeen(path)
      expect(store.chatStatusFor(path)).toBe('seen')
    })

    it('TS-03/TS-04 is "in-progress" while a turn runs and "waiting" while it needs an answer', () => {
      const store = useWorkflowTabActivityStore()
      store.setAgentTurnTabs([{ path, awaitingApproval: false }])
      expect(store.chatStatusFor(path)).toBe('in-progress')

      store.setAgentTurnTabs([{ path, awaitingApproval: true }])
      expect(store.chatStatusFor(path)).toBe('waiting')
    })

    it('TS-07 reports the most urgent state: waiting, then in progress, then unseen, then seen', () => {
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

    it('TS-15 replaces the set of tabs with a chat and drops closed tabs', () => {
      const store = useWorkflowTabActivityStore()
      store.setChatPaths([path, 'workflows/open.json'])
      store.setChatPaths(['workflows/open.json', 'workflows/closed.json'])
      expect(store.chatStatusFor(path)).toBeUndefined()

      store.pruneClosed(['workflows/open.json'])
      expect(store.chatStatusFor('workflows/closed.json')).toBeUndefined()
      expect(store.chatStatusFor('workflows/open.json')).toBe('seen')
    })

    it('clears the unseen marker when a tab loses its last chat but keeps unseen tabs that still have a chat', () => {
      const store = useWorkflowTabActivityStore()
      const other = 'workflows/b.json'
      store.setChatPaths([path, other])
      store.markModified(path)
      store.markModified(other)
      expect(store.chatStatusFor(path)).toBe('unseen')
      expect(store.chatStatusFor(other)).toBe('unseen')

      store.setChatPaths([other])

      expect(store.unseenModifiedPaths.has(path)).toBe(false)
      expect(store.chatStatusFor(path)).toBeUndefined()
      expect(store.unseenModifiedPaths.has(other)).toBe(true)
      expect(store.chatStatusFor(other)).toBe('unseen')
    })

    it('TS-14 clears chat paths together with the rest of the agent activity', () => {
      const store = useWorkflowTabActivityStore()
      store.setChatPaths([path])

      store.clearAgentActivity()

      expect(store.chatStatusFor(path)).toBeUndefined()
    })
  })
})
