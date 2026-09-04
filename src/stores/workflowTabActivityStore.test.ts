import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useWorkflowTabActivityStore } from './workflowTabActivityStore'

describe('useWorkflowTabActivityStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('tracks and clears the tab being edited', () => {
    const store = useWorkflowTabActivityStore()

    store.setEditing('workflows/a.json')
    expect(store.editingTabPath).toBe('workflows/a.json')

    store.setEditing(null)
    expect(store.editingTabPath).toBeNull()
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

  it('prunes state for tabs that are no longer open', () => {
    const store = useWorkflowTabActivityStore()
    store.setEditing('workflows/closed.json')
    store.markModified('workflows/closed.json')
    store.markModified('workflows/open.json')

    store.pruneClosed(['workflows/open.json'])

    expect(store.editingTabPath).toBeNull()
    expect(store.unseenModifiedPaths.has('workflows/closed.json')).toBe(false)
    expect(store.unseenModifiedPaths.has('workflows/open.json')).toBe(true)
  })

  it('keeps the editing path when its tab stays open', () => {
    const store = useWorkflowTabActivityStore()
    store.setEditing('workflows/open.json')

    store.pruneClosed(['workflows/open.json'])

    expect(store.editingTabPath).toBe('workflows/open.json')
  })
})
