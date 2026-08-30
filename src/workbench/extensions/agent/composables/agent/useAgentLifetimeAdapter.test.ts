import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { render } from '@testing-library/vue'

import type { AgentTarget } from '../../types/agentTarget'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import { useAgentLifetimeAdapter } from './useAgentLifetimeAdapter'

const targetA: AgentTarget = {
  workflowId: 'wf-a',
  tabPath: 'workflows/a.json',
  graphId: 'graph-a'
}
const targetB: AgentTarget = {
  workflowId: 'wf-b',
  tabPath: 'workflows/b.json',
  graphId: 'graph-b'
}

function mountAdapter(
  initialTarget: AgentTarget | null = targetA,
  initialEnabled = true
) {
  const enabled = ref(initialEnabled)
  const userId = ref<string | null>('user-a')
  const target = ref<AgentTarget | null>(initialTarget)
  const currentGraphId = ref<string | null>(initialTarget?.graphId ?? null)
  const openTabPaths = ref<readonly string[]>([
    targetA.tabPath,
    targetB.tabPath
  ])
  const follower = {
    retarget: vi.fn(),
    dispose: vi.fn()
  }
  const thread = {
    retarget: vi.fn(),
    close: vi.fn(),
    abort: vi.fn(),
    dispose: vi.fn()
  }
  let selectedTarget!: () => AgentTarget | null
  const host = defineComponent({
    setup() {
      const adapter = useAgentLifetimeAdapter({
        enabled,
        userId,
        target,
        currentGraphId,
        openTabPaths,
        bindings: useAgentWorkflowTabBindingStore(),
        follower,
        thread
      })
      selectedTarget = () => adapter.selectedTarget.value
      return () => null
    }
  })
  const { unmount } = render(host)
  return {
    enabled,
    userId,
    target,
    currentGraphId,
    openTabPaths,
    follower,
    thread,
    selectedTarget,
    unmount
  }
}

describe('useAgentLifetimeAdapter', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('retargets document and thread together for A → B without closing background A', async () => {
    const adapter = mountAdapter()
    adapter.target.value = targetB
    adapter.currentGraphId.value = targetB.graphId
    await nextTick()

    expect(adapter.follower.retarget).toHaveBeenLastCalledWith(targetB)
    expect(adapter.thread.retarget).toHaveBeenLastCalledWith(targetB)
    expect(adapter.thread.close).not.toHaveBeenCalled()
    expect(adapter.selectedTarget()).toEqual(targetB)
  })

  it('performs no cold flag-off work and restores watchers after re-enable', async () => {
    const adapter = mountAdapter(targetA, false)

    expect(adapter.follower.retarget).not.toHaveBeenCalled()
    expect(adapter.thread.abort).not.toHaveBeenCalled()
    expect(adapter.thread.retarget).not.toHaveBeenCalled()

    adapter.enabled.value = true
    await nextTick()
    expect(adapter.follower.retarget).toHaveBeenLastCalledWith(targetA)

    adapter.enabled.value = false
    await nextTick()
    adapter.enabled.value = true
    await nextTick()
    adapter.target.value = targetB
    adapter.currentGraphId.value = targetB.graphId
    await nextTick()

    expect(adapter.follower.retarget).toHaveBeenLastCalledWith(targetB)
    expect(adapter.thread.retarget).toHaveBeenLastCalledWith(targetB)
  })

  it('detaches during a tab handoff until the new graph becomes current', async () => {
    const adapter = mountAdapter()

    adapter.target.value = null
    await nextTick()
    adapter.target.value = targetB
    await nextTick()
    expect(adapter.follower.retarget).toHaveBeenLastCalledWith(null)
    expect(adapter.selectedTarget()).toEqual(targetB)

    adapter.currentGraphId.value = targetB.graphId
    await nextTick()
    expect(adapter.follower.retarget).toHaveBeenLastCalledWith(targetB)
    expect(adapter.selectedTarget()).toEqual(targetB)
  })

  it('prunes a background tab without disturbing the selected target', async () => {
    const bindings = useAgentWorkflowTabBindingStore()
    bindings.setSubject('user-a')
    bindings.bind(targetA.workflowId, targetA.tabPath)
    bindings.bind(targetB.workflowId, targetB.tabPath)
    const adapter = mountAdapter(targetB)
    adapter.follower.retarget.mockClear()

    adapter.openTabPaths.value = [targetB.tabPath]
    await nextTick()

    expect(bindings.tabPathFor(targetA.workflowId)).toBeUndefined()
    expect(adapter.follower.retarget).not.toHaveBeenCalled()
    expect(adapter.thread.close).not.toHaveBeenCalled()
  })

  it.for([targetA, targetB])(
    'detaches and closes the thread when selected $workflowId closes',
    async (selected) => {
      const bindings = useAgentWorkflowTabBindingStore()
      bindings.setSubject('user-a')
      bindings.bind(selected.workflowId, selected.tabPath)
      const adapter = mountAdapter(selected)

      adapter.openTabPaths.value = [
        selected === targetA ? targetB.tabPath : targetA.tabPath
      ]
      await nextTick()

      expect(adapter.follower.retarget).toHaveBeenLastCalledWith(null)
      expect(adapter.thread.close).toHaveBeenCalledWith(selected)
      expect(bindings.tabPathFor(selected.workflowId)).toBeUndefined()
    }
  )

  it('restores the selected target on reload and ignores a delayed binding for A after switching to B', async () => {
    const bindings = useAgentWorkflowTabBindingStore()
    bindings.setSubject('user-a')
    bindings.bind(targetB.workflowId, targetB.tabPath)
    const adapter = mountAdapter(targetB)
    expect(adapter.selectedTarget()).toEqual(targetB)

    bindings.bind(targetA.workflowId, targetA.tabPath)
    await nextTick()

    expect(adapter.selectedTarget()).toEqual(targetB)
    expect(adapter.follower.retarget).toHaveBeenLastCalledWith(targetB)
  })

  it('isolates rapid A → B → A handoff in order', async () => {
    const adapter = mountAdapter(targetA)
    adapter.follower.retarget.mockClear()

    adapter.target.value = targetB
    adapter.currentGraphId.value = targetB.graphId
    await nextTick()
    adapter.target.value = targetA
    adapter.currentGraphId.value = targetA.graphId
    await nextTick()

    expect(adapter.follower.retarget.mock.calls).toEqual([[targetB], [targetA]])
    expect(adapter.selectedTarget()).toEqual(targetA)
  })

  it.for([
    {
      name: 'sign-out',
      trigger: (adapter: ReturnType<typeof mountAdapter>) => {
        adapter.userId.value = null
      }
    },
    {
      name: 'flag-off',
      trigger: (adapter: ReturnType<typeof mountAdapter>) => {
        adapter.enabled.value = false
      }
    }
  ])(
    '$name aborts, detaches and clears the user binding',
    async ({ trigger }) => {
      const bindings = useAgentWorkflowTabBindingStore()
      bindings.setSubject('user-a')
      bindings.bind(targetA.workflowId, targetA.tabPath)
      const adapter = mountAdapter(targetA)

      trigger(adapter)
      await nextTick()

      expect(adapter.follower.retarget).toHaveBeenLastCalledWith(null)
      expect(adapter.thread.abort).toHaveBeenCalledTimes(1)
      expect(bindings.tabPathFor(targetA.workflowId)).toBeUndefined()
      expect(adapter.selectedTarget()).toBeNull()

      const retargetCalls = adapter.follower.retarget.mock.calls.length
      adapter.target.value = targetB
      await nextTick()
      expect(adapter.follower.retarget).toHaveBeenCalledTimes(retargetCalls)
    }
  )

  it('teardown is idempotent', () => {
    const adapter = mountAdapter()
    adapter.unmount()
    adapter.unmount()

    expect(adapter.follower.dispose).toHaveBeenCalledTimes(1)
    expect(adapter.thread.dispose).toHaveBeenCalledTimes(1)
  })
})
