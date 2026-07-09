import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAgentWorkflowTabBindingStore } from './agentWorkflowTabBindingStore'

describe('agentWorkflowTabBindingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('resolves both directions after a bind', () => {
    const store = useAgentWorkflowTabBindingStore()
    store.bind('wf-1', 'workflows/a.json')
    expect(store.tabPathFor('wf-1')).toBe('workflows/a.json')
    expect(store.workflowIdFor('workflows/a.json')).toBe('wf-1')
  })

  it('rebinding a workflow to a new tab releases the old tab', () => {
    const store = useAgentWorkflowTabBindingStore()
    store.bind('wf-1', 'workflows/a.json')
    store.bind('wf-1', 'workflows/b.json')
    expect(store.tabPathFor('wf-1')).toBe('workflows/b.json')
    expect(store.workflowIdFor('workflows/a.json')).toBeUndefined()
    expect(store.workflowIdFor('workflows/b.json')).toBe('wf-1')
  })

  it('binding another workflow to an occupied tab steals it', () => {
    const store = useAgentWorkflowTabBindingStore()
    store.bind('wf-1', 'workflows/a.json')
    store.bind('wf-2', 'workflows/a.json')
    expect(store.workflowIdFor('workflows/a.json')).toBe('wf-2')
    expect(store.tabPathFor('wf-1')).toBeUndefined()
    expect(store.tabPathFor('wf-2')).toBe('workflows/a.json')
  })
})
