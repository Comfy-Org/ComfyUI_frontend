import { describe, expect, it, vi } from 'vitest'

import {
  AgentTargetNavigationError,
  createTargetAwareAgentNavigation
} from './targetAwareAgentNavigation'

interface TestNode {
  id: string
  graph: string
}

interface TestTab {
  path: string
}

function harness() {
  const tabA = { path: 'workflows/a.json' }
  const tabB = { path: 'workflows/b.json' }
  const nodeA = { id: 'shared', graph: 'a' }
  const nodeB = { id: 'shared', graph: 'b' }
  let active = tabB
  const graphs = new Map<TestTab, Map<string, TestNode>>([
    [tabA, new Map([['root-a:shared', nodeA]])],
    [tabB, new Map([['root-b:shared', nodeB]])]
  ])
  const focus = vi.fn()
  const open = vi.fn(async (tab: TestTab) => {
    active = tab
    return true
  })
  const tabs = new Map([
    ['wf-a', tabA],
    ['wf-b', tabB]
  ])
  const navigation = createTargetAwareAgentNavigation<TestTab, TestNode>({
    tabForWorkflow: (workflowId) => tabs.get(workflowId),
    isOpen: (tab) => graphs.has(tab),
    activate: open,
    activeTab: () => active,
    resolveIn: (tab, locatorId) => graphs.get(tab)?.get(locatorId),
    focus
  })

  return {
    focus,
    navigation,
    nodeA,
    nodeB,
    open,
    setActive: (tab: TestTab) => {
      active = tab
    },
    tabA,
    tabB,
    tabs
  }
}

describe('target-aware agent navigation', () => {
  it('resolves an A reference against A even while B is active', async () => {
    const { focus, navigation, nodeA, nodeB, open, tabA } = harness()

    const result = await navigation.navigate({
      workflowId: 'wf-a',
      locatorId: 'root-a:shared'
    })

    expect(result).toBe(nodeA)
    expect(result).not.toBe(nodeB)
    expect(open).toHaveBeenCalledWith(tabA)
    expect(focus).toHaveBeenCalledWith(nodeA)
  })

  it('reports a missing binding as a typed recoverable error', async () => {
    const { navigation } = harness()

    await expect(
      navigation.navigate({ workflowId: 'missing', locatorId: 'root:1' })
    ).rejects.toMatchObject({ code: 'missing_target', recoverable: true })
  })

  it('reports a closed target as a typed recoverable error', async () => {
    const { navigation, tabA, tabs } = harness()
    tabs.set('closed', { ...tabA })

    await expect(
      navigation.navigate({ workflowId: 'closed', locatorId: 'root:1' })
    ).rejects.toBeInstanceOf(AgentTargetNavigationError)
    await expect(
      navigation.navigate({ workflowId: 'closed', locatorId: 'root:1' })
    ).rejects.toMatchObject({ code: 'closed_target', recoverable: true })
  })

  it('does not focus when the locator is stale after activation', async () => {
    const { focus, navigation } = harness()

    await expect(
      navigation.navigate({
        workflowId: 'wf-a',
        locatorId: 'root-a:stale'
      })
    ).rejects.toMatchObject({ code: 'missing_node', recoverable: true })
    expect(focus).not.toHaveBeenCalled()
  })

  it('rejects navigation when the active tab changes during focus', async () => {
    const { focus, navigation, setActive, tabB } = harness()
    focus.mockImplementation(() => setActive(tabB))

    await expect(
      navigation.navigate({
        workflowId: 'wf-a',
        locatorId: 'root-a:shared'
      })
    ).rejects.toMatchObject({ code: 'activation_failed', recoverable: true })
  })
})
