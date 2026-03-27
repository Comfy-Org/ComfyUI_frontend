import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

function hasVisibleNodeInViewport() {
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
}

test.describe('Subgraph viewport restoration', { tag: '@subgraph' }, () => {
  test('first visit fits viewport to subgraph nodes (LG)', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.nextFrame()

    await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      const graph = canvas.graph!
      const sgNode = graph._nodes.find((n) =>
        'isSubgraphNode' in n
          ? (n as unknown as { isSubgraphNode: () => boolean }).isSubgraphNode()
          : false
      ) as unknown as { subgraph?: typeof graph } | undefined
      if (!sgNode?.subgraph) throw new Error('No subgraph node')

      canvas.setGraph(sgNode.subgraph)
    })

    await expect(async () => {
      expect(await comfyPage.page.evaluate(hasVisibleNodeInViewport)).toBe(true)
    }).toPass({ timeout: 2000 })
  })

  test('first visit fits viewport to subgraph nodes (Vue)', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.vueNodes.waitForNodes()

    await comfyPage.vueNodes.enterSubgraph('11')

    await expect(async () => {
      expect(await comfyPage.page.evaluate(hasVisibleNodeInViewport)).toBe(true)
    }).toPass({ timeout: 2000 })
  })

  test('viewport is restored when returning to root (Vue)', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.vueNodes.waitForNodes()

    const rootViewport = await comfyPage.page.evaluate(() => {
      const ds = window.app!.canvas.ds
      return { scale: ds.scale, offset: [...ds.offset] }
    })

    await comfyPage.vueNodes.enterSubgraph('11')
    await comfyPage.nextFrame()

    await comfyPage.subgraph.exitViaBreadcrumb()

    await expect(async () => {
      const restored = await comfyPage.page.evaluate(() => {
        const ds = window.app!.canvas.ds
        return { scale: ds.scale, offset: [...ds.offset] }
      })
      expect(restored.scale).toBeCloseTo(rootViewport.scale, 2)
      expect(restored.offset[0]).toBeCloseTo(rootViewport.offset[0], 0)
      expect(restored.offset[1]).toBeCloseTo(rootViewport.offset[1], 0)
    }).toPass({ timeout: 2000 })
  })
})
