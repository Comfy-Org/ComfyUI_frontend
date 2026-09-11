import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import { useAgentWorkflowTabBindingStore } from './agentWorkflowTabBindingStore'

describe('agentWorkflowTabBindingStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it.for(['before', 'after'])(
    'reconnects a restored draft when bindings initialize %s tab restoration',
    async (timing) => {
      const path = 'workflows/Agent draft.json'
      localStorage.setItem(
        'Comfy.Agent.WorkflowTabBindings',
        JSON.stringify({ 'wf-minted': path })
      )
      const workflows = useWorkflowStore()
      if (timing === 'before') useAgentWorkflowTabBindingStore()
      const restored = workflows.createTemporary('Agent draft.json')
      workflows.openWorkflowsInBackground({ right: [restored.path] })
      const bindings = useAgentWorkflowTabBindingStore()
      await nextTick()

      expect(bindings.tabPathFor('wf-minted')).toBe(restored.path)
      expect(bindings.matchesWorkflow('wf-minted', restored)).toBe(true)

      await workflows.closeWorkflow(restored)
      const replacement = workflows.createTemporary('Agent draft.json')
      workflows.openWorkflowsInBackground({ right: [replacement.path] })
      await nextTick()

      expect(replacement.path).toBe(restored.path)
      expect(bindings.workflowIdFor(replacement.path)).toBeUndefined()
      expect(bindings.matchesWorkflow('wf-minted', replacement)).toBe(false)
    }
  )

  it('releases a closed temporary tab binding before its path is reused', async () => {
    const workflows = useWorkflowStore()
    const first = workflows.createTemporary()
    workflows.openWorkflowsInBackground({ right: [first.path] })
    const bindings = useAgentWorkflowTabBindingStore()
    bindings.bind('wf-first', first.path)
    expect(bindings.matchesWorkflow('wf-first', first)).toBe(true)
    await workflows.closeWorkflow(first)
    const replacement = workflows.createTemporary()
    expect(replacement.path).toBe(first.path)
    expect(bindings.tabPathFor('wf-first')).toBeUndefined()
    expect(bindings.workflowIdFor(replacement.path)).toBeUndefined()
    expect(bindings.matchesWorkflow('wf-first', replacement)).toBe(false)
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

  it('T-18 / PM-664 / FE-1290 keeps sidebar context bound to the active workflow across reload', async () => {
    useAgentWorkflowTabBindingStore().bind('wf-1', 'workflows/a.json')
    await nextTick()
    useAgentWorkflowTabBindingStore().$dispose()

    const reloaded = useAgentWorkflowTabBindingStore()

    expect(reloaded.tabPathFor('wf-1')).toBe('workflows/a.json')
    expect(reloaded.workflowIdFor('workflows/a.json')).toBe('wf-1')
  })

  it('does not resolve prototype-inherited names as bindings', () => {
    const store = useAgentWorkflowTabBindingStore()
    expect(store.tabPathFor('constructor')).toBeUndefined()
    expect(store.workflowIdFor('workflows/missing.json')).toBeUndefined()
  })
})
