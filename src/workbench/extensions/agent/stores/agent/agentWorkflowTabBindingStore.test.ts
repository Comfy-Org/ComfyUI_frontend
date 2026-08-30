import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useAgentWorkflowTabBindingStore } from './agentWorkflowTabBindingStore'

describe('agentWorkflowTabBindingStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    useAgentWorkflowTabBindingStore().setSubject('user-1')
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

  it('bindings survive a reload', async () => {
    useAgentWorkflowTabBindingStore().bind('wf-1', 'workflows/a.json')
    await nextTick()

    setActivePinia(createPinia())
    const reloaded = useAgentWorkflowTabBindingStore()
    reloaded.setSubject('user-1')

    expect(reloaded.tabPathFor('wf-1')).toBe('workflows/a.json')
    expect(reloaded.workflowIdFor('workflows/a.json')).toBe('wf-1')
  })

  it('migrates legacy bindings into the first authenticated subject', () => {
    localStorage.setItem(
      'Comfy.Agent.WorkflowTabBindings',
      JSON.stringify({ 'wf-legacy': 'workflows/legacy.json' })
    )
    setActivePinia(createPinia())

    const store = useAgentWorkflowTabBindingStore()
    store.setSubject('user-1')

    expect(store.tabPathFor('wf-legacy')).toBe('workflows/legacy.json')
  })

  it('does not resolve prototype-inherited names as bindings', () => {
    const store = useAgentWorkflowTabBindingStore()
    expect(store.tabPathFor('constructor')).toBeUndefined()
    expect(store.workflowIdFor('workflows/missing.json')).toBeUndefined()
  })

  it('unbinds either side of a binding explicitly', () => {
    const store = useAgentWorkflowTabBindingStore()
    store.bind('wf-1', 'workflows/a.json')
    store.bind('wf-2', 'workflows/b.json')

    store.unbindWorkflow('wf-1')
    store.unbindTab('workflows/b.json')

    expect(store.tabPathFor('wf-1')).toBeUndefined()
    expect(store.workflowIdFor('workflows/a.json')).toBeUndefined()
    expect(store.tabPathFor('wf-2')).toBeUndefined()
    expect(store.workflowIdFor('workflows/b.json')).toBeUndefined()
  })

  it('prunes bindings for closed tabs and retains open tabs', () => {
    const store = useAgentWorkflowTabBindingStore()
    store.bind('wf-1', 'workflows/a.json')
    store.bind('wf-2', 'workflows/b.json')

    store.pruneClosed(['workflows/b.json'])

    expect(store.tabPathFor('wf-1')).toBeUndefined()
    expect(store.tabPathFor('wf-2')).toBe('workflows/b.json')
  })

  it('isolates persisted bindings by authenticated subject', async () => {
    const store = useAgentWorkflowTabBindingStore()
    store.setSubject('user-a')
    store.bind('wf-a', 'workflows/a.json')
    await nextTick()

    store.setSubject('user-b')
    expect(store.tabPathFor('wf-a')).toBeUndefined()
    store.bind('wf-b', 'workflows/b.json')

    store.setSubject('user-a')
    expect(store.tabPathFor('wf-a')).toBe('workflows/a.json')
    expect(store.tabPathFor('wf-b')).toBeUndefined()
  })

  it('reset clears only the active subject bindings', () => {
    const store = useAgentWorkflowTabBindingStore()
    store.setSubject('user-a')
    store.bind('wf-a', 'workflows/a.json')
    store.setSubject('user-b')
    store.bind('wf-b', 'workflows/b.json')

    store.reset()
    expect(store.tabPathFor('wf-b')).toBeUndefined()

    store.setSubject('user-a')
    expect(store.tabPathFor('wf-a')).toBe('workflows/a.json')
  })
})
