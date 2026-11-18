import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Subgraph IO canonical order', { tag: '@subgraph' }, () => {
  test('SubgraphNode input order matches canonical subgraph definition after load', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.nextFrame()

    const result = await comfyPage.page.evaluate(() => {
      const graph = window.app!.canvas.graph!
      const sgNode = graph._nodes.find(
        (n: { isSubgraphNode?: () => boolean }) => n.isSubgraphNode?.()
      ) as
        | {
            subgraph?: { inputNode: { slots: Array<{ name: string }> } }
            inputs: Array<{ name: string }>
          }
        | undefined

      if (!sgNode?.subgraph) return { error: 'No subgraph node' }

      const canonicalOrder = sgNode.subgraph.inputNode.slots.map((s) => s.name)
      const outerOrder = sgNode.inputs.map((i) => i.name)

      return { canonicalOrder, outerOrder }
    })

    expect(result).not.toHaveProperty('error')
    expect(result.outerOrder).toEqual(result.canonicalOrder)
  })

  test('SubgraphNode input order is stable across serialize/configure cycles', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.nextFrame()

    const result = await comfyPage.page.evaluate(() => {
      const graph = window.app!.canvas.graph!
      const sgNode = graph._nodes.find(
        (n: { isSubgraphNode?: () => boolean }) => n.isSubgraphNode?.()
      ) as
        | {
            inputs: Array<{ name: string }>
            serialize: () => unknown
            configure: (data: unknown) => void
          }
        | undefined

      if (!sgNode) return { error: 'No subgraph node' }

      const orderBefore = sgNode.inputs.map((i) => i.name)

      // Serialize and reconfigure three times
      for (let i = 0; i < 3; i++) {
        const data = sgNode.serialize()
        sgNode.configure(data)
      }

      const orderAfter = sgNode.inputs.map((i) => i.name)

      return { orderBefore, orderAfter }
    })

    expect(result).not.toHaveProperty('error')
    expect(result.orderAfter).toEqual(result.orderBefore)
  })
})
