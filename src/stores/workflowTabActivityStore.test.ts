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
})
