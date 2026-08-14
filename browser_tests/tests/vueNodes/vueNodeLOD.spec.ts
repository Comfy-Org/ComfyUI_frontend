import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Vue node low-zoom LOD',
  { tag: ['@vue-nodes', '@canvas'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.LowZoomLOD', false)
      await comfyPage.settings.setSetting('Comfy.VueNodes.FullDetailZoom', 95)
      await comfyPage.canvasOps.resetView()
    })

    test('switches paint detail strictly below the configured zoom', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.settings.setSetting('Comfy.VueNodes.LowZoomLOD', true)
      await comfyPage.settings.setSetting('Comfy.VueNodes.FullDetailZoom', 95)
      const node = await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
      const nodeId = await node.root.getAttribute('data-node-id')
      if (!nodeId) throw new Error('Load Checkpoint node ID not found')
      const nodeRef = await comfyPage.nodeOps.getNodeRefById(nodeId)

      async function getNodeDomSize() {
        return await node.root.evaluate((element) => {
          if (!(element instanceof HTMLElement)) {
            throw new Error('Vue node root is not an HTML element')
          }
          return {
            width: element.offsetWidth,
            height: element.offsetHeight
          }
        })
      }

      const widget = node.root.locator('.lg-node-widget').first()
      const initialDomSize = await getNodeDomSize()
      const initialNodeSize = await nodeRef.getSize()

      await comfyPage.page.evaluate(() => {
        window.app!.canvas.ds.scale = 0.949
        window.app!.canvas.setDirty(true, true)
      })
      await expect
        .poll(() => comfyPage.page.locator('html').getAttribute('class'))
        .toContain('vue-nodes-low-detail')
      await expect
        .poll(() => widget.evaluate((el) => getComputedStyle(el).visibility))
        .toBe('hidden')
      expect(await getNodeDomSize()).toEqual(initialDomSize)
      expect(await nodeRef.getSize()).toEqual(initialNodeSize)

      await comfyPage.page.evaluate(() => {
        window.app!.canvas.ds.scale = 0.95
        window.app!.canvas.setDirty(true, true)
      })
      await expect
        .poll(() => comfyPage.page.locator('html').getAttribute('class'))
        .not.toContain('vue-nodes-low-detail')
      await expect
        .poll(() => widget.evaluate((el) => getComputedStyle(el).visibility))
        .toBe('visible')
    })

    test('starts resizing below the full-detail zoom threshold', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.settings.setSetting('Comfy.VueNodes.LowZoomLOD', true)
      await comfyPage.settings.setSetting('Comfy.VueNodes.FullDetailZoom', 95)
      const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const nodeId = await node.root.getAttribute('data-node-id')
      if (!nodeId) throw new Error('KSampler node ID not found')
      const nodeRef = await comfyPage.nodeOps.getNodeRefById(nodeId)
      const initialSize = await nodeRef.getSize()

      await comfyPage.page.evaluate(() => {
        window.app!.canvas.ds.scale = 0.949
        window.app!.canvas.setDirty(true, true)
      })
      await expect
        .poll(() => comfyPage.page.locator('html').getAttribute('class'))
        .toContain('vue-nodes-low-detail')
      await expect(node.root.locator('[data-corner="SE"]')).toBeVisible()

      await node.resizeFromCorner('SE', 40, 30)

      await expect
        .poll(async () => {
          const size = await nodeRef.getSize()
          return (
            size.width > initialSize.width && size.height > initialSize.height
          )
        })
        .toBe(true)
    })
  }
)
