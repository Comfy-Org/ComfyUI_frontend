import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

test.describe(
  'Vue node viewport virtualization',
  { tag: ['@vue-nodes', '@canvas'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.ViewportVirtualization',
        false
      )
      await comfyPage.settings.setSetting('Comfy.VueNodes.LowZoomLOD', true)
      await comfyPage.settings.setSetting('Comfy.VueNodes.FullDetailZoom', 95)
      await comfyPage.canvasOps.resetView()
    })

    test('hydrates all nodes, then swaps only after the viewport settles', async ({
      comfyPage
    }) => {
      const graphNodeIds = await comfyPage.page.evaluate(() => {
        const nodes = window.app!.graph.nodes
        nodes.forEach((node, index) => {
          const x = index < 2 ? 100 + index * 500 : 1800 + (index - 2) * 1800
          node.setPos(x, 100)
          node.updateArea()
        })
        const canvas = window.app!.canvas
        canvas.ds.offset[0] = 0
        canvas.ds.offset[1] = 0
        canvas.ds.scale = 1
        canvas.setDirty(true, true)
        return nodes.map((node) => String(node.id))
      })
      await comfyPage.nextFrame()

      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.ViewportVirtualization',
        true
      )

      const firstViewportIds = graphNodeIds.slice(0, 2)
      await expect
        .poll(() => comfyPage.vueNodes.getNodeIds())
        .toEqual(firstViewportIds)

      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        canvas.ds.offset[0] = -1800
        canvas.setDirty(true, true)
      })
      await comfyPage.nextFrame()

      expect(await comfyPage.vueNodes.getNodeIds()).toEqual(firstViewportIds)
      await expect
        .poll(() => comfyPage.vueNodes.getNodeIds())
        .toEqual([graphNodeIds[2]])
      expect(
        await comfyPage.page.evaluate(() => window.app!.graph.nodes.length)
      ).toBe(graphNodeIds.length)
    })

    test('keeps a multi-node drag mount set frozen during edge auto-pan', async ({
      comfyPage
    }) => {
      const graphNodeIds = await comfyPage.page.evaluate(() => {
        const nodes = window.app!.graph.nodes
        nodes.forEach((node, index) => {
          const x = index < 2 ? 100 + index * 500 : 1800 + (index - 2) * 1800
          node.setPos(x, 100)
          node.updateArea()
        })
        const canvas = window.app!.canvas
        canvas.ds.offset[0] = 0
        canvas.ds.offset[1] = 0
        canvas.ds.scale = 1
        canvas.setDirty(true, true)
        return nodes.map((node) => String(node.id))
      })
      await comfyPage.nextFrame()
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.ViewportVirtualization',
        true
      )

      const initialIds = graphNodeIds.slice(0, 2)
      await expect
        .poll(() => comfyPage.vueNodes.getNodeIds())
        .toEqual(initialIds)
      await comfyPage.vueNodes.selectNodes(initialIds)

      const dragNode = comfyPage.vueNodes.getNodeLocator(initialIds[0])
      const header = dragNode.locator('.lg-node-header')
      const headerBox = await header.boundingBox()
      const canvasBox = await comfyPage.canvas.boundingBox()
      if (!headerBox || !canvasBox) throw new Error('Drag geometry unavailable')

      const initialOffset = await comfyPage.canvasOps.getOffset()
      await comfyPage.page.mouse.move(
        headerBox.x + headerBox.width / 2,
        headerBox.y + headerBox.height / 2
      )
      await comfyPage.page.mouse.down()
      try {
        await comfyPage.page.mouse.move(
          canvasBox.x + canvasBox.width - 2,
          canvasBox.y + canvasBox.height / 2,
          { steps: 10 }
        )
        await expect
          .poll(() => comfyPage.canvasOps.getOffset())
          .not.toEqual(initialOffset)
        expect(await comfyPage.vueNodes.getNodeIds()).toEqual(initialIds)
      } finally {
        await comfyPage.page.mouse.up()
      }
    })

    test('keeps a group drag mounted until the interaction ends', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('groups/oversized_group')
      const nodeId = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes[0]
        const group = window.app!.graph.groups[0]
        node.setPos(100, 100)
        node.updateArea()
        group.pos = [50, 50]
        group.size = [900, 825]
        group.recomputeInsideNodes()
        const canvas = window.app!.canvas
        canvas.ds.offset[0] = 0
        canvas.ds.offset[1] = 0
        canvas.ds.scale = 1
        canvas.setDirty(true, true)
        return String(node.id)
      })
      await comfyPage.nextFrame()
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.ViewportVirtualization',
        true
      )
      await expect.poll(() => comfyPage.vueNodes.getNodeIds()).toEqual([nodeId])

      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        const node = window.app!.graph.nodes[0]
        canvas.isDragging = true
        node.setPos(3100, 100)
        node.updateArea()
        canvas.setDirty(true, true)
      })
      await comfyPage.page.waitForTimeout(400)
      expect(await comfyPage.vueNodes.getNodeIds()).toEqual([nodeId])

      await comfyPage.page.evaluate(() => {
        window.app!.canvas.isDragging = false
        window.dispatchEvent(new PointerEvent('pointerup'))
      })
      await expect.poll(() => comfyPage.vueNodes.getNodeIds()).toEqual([])
    })

    test('hydrates a node pasted into a distant settled viewport', async ({
      comfyPage
    }) => {
      const sourceId = await comfyPage.page.evaluate(() => {
        const [source, ...otherNodes] = window.app!.graph.nodes
        source.setPos(100, 100)
        source.updateArea()
        otherNodes.forEach((node, index) => {
          node.setPos(4000 + index * 1800, 100)
          node.updateArea()
        })
        const canvas = window.app!.canvas
        canvas.ds.offset[0] = 0
        canvas.ds.offset[1] = 0
        canvas.ds.scale = 1
        canvas.setDirty(true, true)
        return String(source.id)
      })
      await comfyPage.nextFrame()
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.ViewportVirtualization',
        true
      )

      await expect
        .poll(() => comfyPage.vueNodes.getNodeIds())
        .toEqual([sourceId])
      await comfyPage.vueNodes.getNodeLocator(sourceId).click()
      await comfyPage.clipboard.copy()
      await comfyPage.page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
      })

      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        canvas.ds.offset[0] = -1800
        canvas.setDirty(true, true)
      })
      const canvasBox = await comfyPage.canvas.boundingBox()
      if (!canvasBox) throw new Error('Canvas geometry unavailable')
      await comfyPage.page.mouse.move(
        canvasBox.x + canvasBox.width / 2,
        canvasBox.y + canvasBox.height / 2
      )
      await expect.poll(() => comfyPage.vueNodes.getNodeIds()).toEqual([])

      const graphNodeCount = await comfyPage.page.evaluate(
        () => window.app!.graph.nodes.length
      )
      await comfyPage.clipboard.paste()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => window.app!.graph.nodes.length)
        )
        .toBe(graphNodeCount + 1)
      await expect.poll(() => comfyPage.vueNodes.getNodeIds()).toHaveLength(1)
    })

    test('mounts a distant link target after auto-pan pauses', async ({
      comfyPage
    }) => {
      const ids = await comfyPage.page.evaluate(() => {
        const graph = window.app!.graph
        const source = graph.nodes.find(
          (node) => node.getTitle() === 'Load Diffusion Model'
        )!
        const target = graph.nodes.find(
          (node) => node.getTitle() === 'KSampler'
        )!
        source.setPos(100, 100)
        target.setPos(1800, 100)
        source.updateArea()
        target.updateArea()
        graph.nodes
          .filter((node) => node !== source && node !== target)
          .forEach((node, index) => {
            node.setPos(4000 + index * 1800, 100)
            node.updateArea()
          })
        const targetSlot = target.findInputSlot('model')
        if (targetSlot >= 0) target.disconnectInput(targetSlot)
        const canvas = window.app!.canvas
        canvas.ds.offset[0] = 0
        canvas.ds.offset[1] = 0
        canvas.ds.scale = 1
        canvas.setDirty(true, true)
        return { source: String(source.id), target: String(target.id) }
      })
      await comfyPage.nextFrame()
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.ViewportVirtualization',
        true
      )

      await expect(comfyPage.vueNodes.getNodeLocator(ids.source)).toBeVisible()
      await expect(comfyPage.vueNodes.getNodeLocator(ids.target)).toHaveCount(0)

      const source = await comfyPage.vueNodes.getFixtureByTitle(
        'Load Diffusion Model'
      )
      const sourceSlot = source.getSlot('MODEL')
      const sourceBox = await sourceSlot.boundingBox()
      const canvasBox = await comfyPage.canvas.boundingBox()
      if (!sourceBox || !canvasBox) throw new Error('Link geometry unavailable')

      await comfyPage.page.mouse.move(
        sourceBox.x + sourceBox.width / 2,
        sourceBox.y + sourceBox.height / 2
      )
      await comfyPage.page.mouse.down()
      try {
        await comfyPage.page.mouse.move(
          canvasBox.x + canvasBox.width - 2,
          canvasBox.y + canvasBox.height / 2
        )
        await expect
          .poll(async () => (await comfyPage.canvasOps.getOffset())[0])
          .toBeLessThan(-1000)

        await comfyPage.page.mouse.move(
          canvasBox.x + canvasBox.width / 2,
          canvasBox.y + canvasBox.height / 2
        )
        await expect(
          comfyPage.vueNodes.getNodeLocator(ids.target)
        ).toBeVisible()

        const target = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
        const targetSlot = target.getSlot('model')
        const targetBox = await targetSlot.boundingBox()
        if (!targetBox) throw new Error('Target slot geometry unavailable')
        await comfyPage.page.mouse.move(
          targetBox.x + targetBox.width / 2,
          targetBox.y + targetBox.height / 2
        )
      } finally {
        await comfyPage.page.mouse.up()
      }

      await expect
        .poll(() =>
          comfyPage.page.evaluate((targetId) => {
            const target = window.app!.graph.getNodeById(targetId)
            const slot = target?.findInputSlot('model') ?? -1
            return slot >= 0 ? target?.inputs[slot].link : null
          }, toNodeId(ids.target))
        )
        .not.toBeNull()
    })

    test('switches paint detail strictly below the configured zoom', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.LowZoomLOD', true)
      await comfyPage.settings.setSetting('Comfy.VueNodes.FullDetailZoom', 95)
      const widget = comfyPage.vueNodes.nodes.locator('.lg-node-widget').first()

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
  }
)
