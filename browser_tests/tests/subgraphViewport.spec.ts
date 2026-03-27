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

    await comfyPage.nextFrame()
    await comfyPage.nextFrame()
    await comfyPage.nextFrame()

    expect(await comfyPage.page.evaluate(hasVisibleNodeInViewport)).toBe(true)
  })

  test('first visit fits viewport to subgraph nodes (Vue)', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.vueNodes.waitForNodes()

    // Enter the subgraph via Vue nodes helper
    await comfyPage.vueNodes.enterSubgraph('11')
    await comfyPage.nextFrame()
    await comfyPage.nextFrame()
    await comfyPage.nextFrame()

    expect(await comfyPage.page.evaluate(hasVisibleNodeInViewport)).toBe(true)
  })

  test('viewport is restored when returning to root (Vue)', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.vueNodes.waitForNodes()

    // Capture root viewport before entering subgraph
    const rootViewport = await comfyPage.page.evaluate(() => {
      const ds = window.app!.canvas.ds
      return { scale: ds.scale, offset: [...ds.offset] }
    })

    // Enter subgraph
    await comfyPage.vueNodes.enterSubgraph('11')
    await comfyPage.nextFrame()
    await comfyPage.nextFrame()

    // Verify viewport changed (we're in a different graph now)
    const subgraphViewport = await comfyPage.page.evaluate(() => {
      const ds = window.app!.canvas.ds
      return { scale: ds.scale, offset: [...ds.offset] }
    })
    expect(subgraphViewport).not.toEqual(rootViewport)

    // Exit via breadcrumb
    await comfyPage.subgraph.exitViaBreadcrumb()
    await comfyPage.nextFrame()
    await comfyPage.nextFrame()

    // Verify root viewport is restored
    const restoredViewport = await comfyPage.page.evaluate(() => {
      const ds = window.app!.canvas.ds
      return { scale: ds.scale, offset: [...ds.offset] }
    })
    expect(restoredViewport.scale).toBeCloseTo(rootViewport.scale, 2)
    expect(restoredViewport.offset[0]).toBeCloseTo(rootViewport.offset[0], 0)
    expect(restoredViewport.offset[1]).toBeCloseTo(rootViewport.offset[1], 0)
  })
})
