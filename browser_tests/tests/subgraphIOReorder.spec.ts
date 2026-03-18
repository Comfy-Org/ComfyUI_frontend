import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Subgraph IO reorder', { tag: '@subgraph' }, () => {
  test('reorderInput updates inner slot order and outer SubgraphNode pins', async ({
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
            subgraph?: {
              inputs: Array<{ name: string }>
              reorderInput: (from: number, to: number) => void
            }
            inputs: Array<{ name: string }>
          }
        | undefined

      if (!sgNode?.subgraph) return { error: 'No subgraph node' }
      if (sgNode.subgraph.inputs.length < 2)
        return { error: 'Need 2+ inputs to test reorder' }

      const innerBefore = sgNode.subgraph.inputs.map((i) => i.name)
      const outerBefore = sgNode.inputs.map((i) => i.name)

      // Swap first two inputs
      sgNode.subgraph.reorderInput(0, 1)

      const innerAfter = sgNode.subgraph.inputs.map((i) => i.name)
      const outerAfter = sgNode.inputs.map((i) => i.name)

      return { innerBefore, outerBefore, innerAfter, outerAfter }
    })

    expect(result).not.toHaveProperty('error')

    // Inner and outer should match after reorder
    expect(result.innerAfter).toEqual(result.outerAfter)

    // Order should have changed
    expect(result.innerAfter).not.toEqual(result.innerBefore)
  })

  test('reorder is stable across serialize/configure cycle', async ({
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
            subgraph?: {
              inputs: Array<{ name: string }>
              reorderInput: (from: number, to: number) => void
            }
            inputs: Array<{ name: string }>
            serialize: () => unknown
            configure: (data: unknown) => void
          }
        | undefined

      if (!sgNode?.subgraph) return { error: 'No subgraph node' }
      if (sgNode.subgraph.inputs.length < 2) return { error: 'Need 2+ inputs' }

      sgNode.subgraph.reorderInput(0, 1)
      const afterReorder = sgNode.inputs.map((i) => i.name)

      // Serialize and reconfigure
      const data = sgNode.serialize()
      sgNode.configure(data)
      const afterCycle = sgNode.inputs.map((i) => i.name)

      return { afterReorder, afterCycle }
    })

    expect(result).not.toHaveProperty('error')
    expect(result.afterCycle).toEqual(result.afterReorder)
  })
})
