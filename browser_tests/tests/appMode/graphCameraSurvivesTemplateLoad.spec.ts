import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

/**
 * PM-1732 / PM-1733 — App Mode keeps the graph canvas mounted but hidden, so
 * its element measures 0x0. Loading a template from there used to fit the view
 * against that zero-size element, leaving the camera at scale 0 with NaN
 * offsets, and returning to the graph showed a blank canvas with every node
 * still in it.
 */
test.describe('App mode template load', { tag: ['@canvas'] }, () => {
  test.describe.configure({ timeout: 30_000 })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('keeps the graph framed on the nodes when returning from app mode', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    const canvasWidth = () => page.evaluate(() => window.app!.canvasEl.width)
    const viewMode = () =>
      page.evaluate(() => {
        const workflow = window.app!.extensionManager.workflow.activeWorkflow
        return workflow?.activeMode ?? workflow?.initialMode ?? 'graph'
      })
    const framing = () =>
      page.evaluate(() => {
        const app = window.app!
        const { ds } = app.canvas
        const [vx, vy, vw, vh] = ds.visible_area
        const nodesInView = app.rootGraph.nodes.filter((node) => {
          const [x, y, w, h] = node.boundingRect
          return x < vx + vw && vx < x + w && y < vy + vh && vy < y + h
        }).length
        return {
          scale: ds.scale,
          offset: [...ds.offset],
          nodeCount: app.rootGraph.nodes.length,
          nodesInView
        }
      })

    await comfyPage.appMode.enterAppModeWithInputs([['3', 'seed']])
    await expect(comfyPage.appMode.centerPanel).toBeVisible()
    await expect
      .poll(canvasWidth, { message: 'app mode hides the canvas' })
      .toBe(0)

    // Park the camera far off the nodes. The guard alone leaves whatever
    // camera was already there, so without the deferred fit this is what the
    // user returns to -- that is the difference this test exists to catch.
    await page.evaluate(() => {
      const { ds } = window.app!.canvas
      ds.offset[0] = -60000
      ds.offset[1] = -60000
      ds.scale = 0.05
    })

    // App templates carry extra.linearMode, which keeps App Mode active across
    // the load so the fit lands while the canvas is still hidden. Without it
    // the load drops back to graph mode and never exercises this path.
    const graph = await comfyPage.nodeOps.getSerializedGraph()
    const template = { ...graph, extra: { ...graph.extra, linearMode: true } }

    // The shape useTemplateWorkflows loads a template with: a string workflow
    // name plus openSource 'template'.
    await page.evaluate(
      ({ json, name }) =>
        window.app!.loadGraphData(json, true, true, name, {
          openSource: 'template'
        }),
      { json: template, name: 'pm-1733-template' }
    )

    await expect
      .poll(viewMode, { message: 'the template stays in app mode' })
      .toBe('app')
    await expect
      .poll(canvasWidth, { message: 'the canvas is still hidden' })
      .toBe(0)

    await comfyPage.appMode.toggleAppMode()
    await expect.poll(viewMode).toBe('graph')
    await expect.poll(canvasWidth).toBeGreaterThan(0)

    await expect
      .poll(async () => (await framing()).nodesInView)
      .toBeGreaterThan(0)

    const { scale, offset, nodeCount, nodesInView } = await framing()
    expect(nodeCount, 'nodes survive the template load').toBeGreaterThan(0)
    expect(scale, 'camera scale stays usable').toBeGreaterThan(0)
    expect(
      offset.every(Number.isFinite),
      `camera offset stays finite, got ${JSON.stringify(offset)}`
    ).toBe(true)
    expect(nodesInView, 'the graph is framed on its nodes').toBeGreaterThan(0)
  })
})
