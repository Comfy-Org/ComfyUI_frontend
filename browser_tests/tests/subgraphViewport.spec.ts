import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Subgraph viewport restoration', { tag: '@subgraph' }, () => {
  test('first visit fits viewport to subgraph nodes', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.nextFrame()

    const result = await comfyPage.page.evaluate(() => {
      const graph = window.app!.canvas.graph!
      const sgNode = graph._nodes.find(
        (n: { isSubgraphNode?: () => boolean }) => n.isSubgraphNode?.()
      ) as { subgraph?: unknown } | undefined
      if (!sgNode?.subgraph) return { error: 'No subgraph node' }

      window.app!.canvas.openSubgraph(sgNode.subgraph as never, sgNode as never)
      return { entered: true }
    })
    expect(result).not.toHaveProperty('error')

    // Wait for rAF fitToBounds to settle
    await comfyPage.nextFrame()
    await comfyPage.nextFrame()
    await comfyPage.nextFrame()

    const hasVisibleNode = await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      if (!canvas?.graph?._nodes?.length) return false

      const ds = canvas.ds
      const cw = canvas.canvas.width / window.devicePixelRatio
      const ch = canvas.canvas.height / window.devicePixelRatio
      const visLeft = -ds.offset[0]
      const visTop = -ds.offset[1]
      const visRight = visLeft + cw / ds.scale
      const visBottom = visTop + ch / ds.scale

      for (const node of canvas.graph._nodes) {
        const [nx, ny] = node.pos
        const [nw, nh] = node.size
        if (
          nx + nw > visLeft &&
          nx < visRight &&
          ny + nh > visTop &&
          ny < visBottom
        )
          return true
      }
      return false
    })

    expect(hasVisibleNode).toBe(true)
  })
})
