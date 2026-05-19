import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('GetNode default input', { tag: ['@node'] }, () => {
  test('getInputLink resolves via matching SetNode without stack overflow', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/get_node_with_setter')

    const result = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph
      const getNode = graph.nodes.find((n) => n.type === 'GetNode')
      if (!getNode) throw new Error('GetNode not found')

      // If the mutual recursion bug is present this call will throw a
      // RangeError: Maximum call stack size exceeded
      const link = getNode.getInputLink(0)
      return link ? { id: link.id, origin_id: link.origin_id } : null
    })

    // The link should be the one connecting Reroute (id=1) → SetNode
    expect(result).not.toBeNull()
    expect(result!.origin_id).toBe(1)
  })

  test('getInputLink returns null for non-zero slot when setter is found', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/get_node_with_setter')

    const result = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph
      const getNode = graph.nodes.find((n) => n.type === 'GetNode')
      if (!getNode) throw new Error('GetNode not found')

      // SetNode only has slot 0; requesting slot 1 should not crash and
      // should fall through to the default input (which is unconnected here)
      return getNode.getInputLink(1)
    })

    expect(result).toBeNull()
  })

  test('getInputLink falls back to default input when no matching SetNode exists', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/get_node_with_default')

    const result = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph
      const getNode = graph.nodes.find((n) => n.type === 'GetNode')
      if (!getNode) throw new Error('GetNode not found')

      const link = getNode.getInputLink(0)
      return link ? { id: link.id, origin_id: link.origin_id } : null
    })

    // The link should be the one connecting Reroute (id=1) → GetNode default
    expect(result).not.toBeNull()
    expect(result!.origin_id).toBe(1)
  })
})
