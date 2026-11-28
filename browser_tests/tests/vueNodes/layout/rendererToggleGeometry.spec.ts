import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { PropertiesPanel } from '@e2e/fixtures/components/PropertiesPanel'
import { TestIds } from '@e2e/fixtures/selectors'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

const LEGACY_TITLE_HEIGHT = 30

test.describe('Renderer toggle geometry', { tag: ['@vue-nodes'] }, () => {
  test('slot geometry survives a Vue to legacy round trip', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')

    const nodeId = toNodeId(
      await comfyPage.vueNodes.getNodeIdByTitle('KSampler')
    )

    await comfyPage.vueNodes.waitForSlotLayout(nodeId)
    const before = await comfyPage.canvasOps.getNodeGeometry(nodeId)
    expect(
      before.inputs.length + before.outputs.length,
      'fixture node must have slots for this test to mean anything'
    ).toBeGreaterThan(0)

    const { header } = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    const headerBox = await header.boundingBox()
    if (!headerBox) throw new Error('KSampler header not found')

    const startX = headerBox.x + headerBox.width / 2
    const startY = headerBox.y + headerBox.height / 2
    await comfyPage.page.mouse.move(startX, startY)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(startX + 120, startY + 90, { steps: 10 })
    await comfyPage.page.mouse.up()
    await comfyPage.nextFrame()

    await comfyPage.vueNodes.waitForSlotLayout(nodeId)
    await expect
      .poll(async () => {
        const { size } = await comfyPage.canvasOps.getNodeGeometry(nodeId)
        return size
      })
      .toEqual(before.size)
    const moved = await comfyPage.canvasOps.getNodeGeometry(nodeId)
    comfyPage.canvasOps.expectSlotsTrackedNode(moved, before)

    await comfyPage.menu.topbar.setVueNodesEnabled(false)
    await comfyPage.nextFrame()
    await expect(comfyPage.vueNodes.nodes).toHaveCount(0)

    await expect(async () => {
      const legacyGeometry = await comfyPage.canvasOps.getNodeGeometry(nodeId)
      expect(legacyGeometry.pos[0], 'legacy x').toBeCloseTo(moved.pos[0], 0)
      expect(legacyGeometry.pos[1], 'legacy y').toBeCloseTo(moved.pos[1], 0)
      expect(legacyGeometry.size, 'legacy size').toEqual(moved.size)
      comfyPage.canvasOps.expectSlotsOnNode(
        legacyGeometry,
        'after switching to legacy'
      )
    }).toPass({ timeout: 5000 })

    await comfyPage.menu.topbar.setVueNodesEnabled(true)

    await expect(async () => {
      comfyPage.canvasOps.expectNodeGeometryPreserved(
        await comfyPage.canvasOps.getNodeGeometry(nodeId),
        moved,
        'after switching back to Vue'
      )
    }).toPass({ timeout: 5000 })
  })

  test(
    'preserves frontmost order after a legacy drag',
    { tag: ['@node'] },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('vueNodes/simple-triple')
      await comfyPage.menu.topbar.setVueNodesEnabled(false)
      await comfyPage.nextFrame()
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
      await fitToViewInstant(comfyPage)

      const [ksampler] = await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      const [clip] = await comfyPage.nodeOps.getNodeRefsByTitle(
        'CLIP Text Encode (Prompt)'
      )
      const ksamplerPosition = await ksampler.getPosition()
      const clipPosition = await clip.getPosition()

      await ksampler.dragBy({
        x: clipPosition.x - ksamplerPosition.x,
        y: clipPosition.y - ksamplerPosition.y
      })
      await comfyPage.nextFrame()
      await expect
        .poll(async () => {
          const draggedPosition = await ksampler.getPosition()
          return Math.max(
            Math.abs(draggedPosition.x - clipPosition.x),
            Math.abs(draggedPosition.y - clipPosition.y)
          )
        })
        .toBeLessThanOrEqual(5)

      await comfyPage.menu.topbar.setVueNodesEnabled(true)
      await expect(comfyPage.vueNodes.nodes).toHaveCount(3)

      const ksamplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler')
      await expect
        .poll(async () => {
          const ksamplerZIndex = await ksamplerNode.evaluate((node) =>
            Number(getComputedStyle(node).zIndex)
          )
          const zIndices = await comfyPage.vueNodes.nodes.evaluateAll((nodes) =>
            nodes.map((node) => Number(getComputedStyle(node).zIndex))
          )
          return zIndices.filter((zIndex) => zIndex >= ksamplerZIndex).length
        })
        .toBe(1)
    }
  )

  test(
    'preserves frontmost order when switching to legacy rendering',
    { tag: ['@node'] },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('vueNodes/simple-triple')
      await fitToViewInstant(comfyPage)

      const [ksampler] = await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      const [clip] = await comfyPage.nodeOps.getNodeRefsByTitle(
        'CLIP Text Encode (Prompt)'
      )
      const ksamplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler')
      const clipNode = comfyPage.vueNodes.getNodeByTitle('CLIP Text Encode')
      const { header } = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const { header: clipHeader } =
        await comfyPage.vueNodes.getFixtureByTitle('CLIP Text Encode')
      const headerBox = await header.boundingBox()
      const clipBox = await clipHeader.boundingBox()
      if (!headerBox || !clipBox) throw new Error('Fixture nodes not found')

      await comfyPage.canvasOps.dragAndDrop(
        {
          x: headerBox.x + headerBox.width / 2,
          y: headerBox.y + headerBox.height / 2
        },
        {
          x: clipBox.x + clipBox.width / 2,
          y: clipBox.y + clipBox.height / 2
        }
      )

      await expect
        .poll(async () => {
          const ksamplerZIndex = await ksamplerNode.evaluate((node) =>
            Number(getComputedStyle(node).zIndex)
          )
          const clipZIndex = await clipNode.evaluate((node) =>
            Number(getComputedStyle(node).zIndex)
          )
          return ksamplerZIndex - clipZIndex
        })
        .toBeGreaterThan(0)

      await comfyPage.menu.topbar.setVueNodesEnabled(false)
      await comfyPage.nextFrame()
      await comfyPage.page.evaluate(() => window.app!.canvas.deselectAll())
      expect(await comfyPage.nodeOps.getSelectedNodeIds()).toEqual([])

      const ksamplerGeometry = await comfyPage.canvasOps.getNodeGeometry(
        ksampler.id
      )
      const clipGeometry = await comfyPage.canvasOps.getNodeGeometry(clip.id)
      const overlap = {
        left: Math.max(ksamplerGeometry.pos[0], clipGeometry.pos[0]),
        top: Math.max(
          ksamplerGeometry.pos[1] - LEGACY_TITLE_HEIGHT,
          clipGeometry.pos[1] - LEGACY_TITLE_HEIGHT
        ),
        right: Math.min(
          ksamplerGeometry.pos[0] + ksamplerGeometry.size[0],
          clipGeometry.pos[0] + clipGeometry.size[0]
        ),
        bottom: Math.min(ksamplerGeometry.pos[1], clipGeometry.pos[1])
      }
      if (overlap.left >= overlap.right || overlap.top >= overlap.bottom) {
        throw new Error('Fixture nodes do not overlap')
      }

      const clickPosition = await comfyPage.canvasOps.convertOffsetToCanvas([
        (overlap.left + overlap.right) / 2,
        (overlap.top + overlap.bottom) / 2
      ])
      await comfyPage.canvasOps.mouseClickAt({
        x: clickPosition[0],
        y: clickPosition[1]
      })

      await expect
        .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
        .toEqual([ksampler.id])
    }
  )
})

test.describe(
  'Renderer toggle with the properties panel open',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test('a legacy widget the panel drew in Vue nodes takes canvas clicks across its full node width after switching to LiteGraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      const nodeId = toNodeId(
        await comfyPage.vueNodes.getNodeIdByTitle('KSampler')
      )
      await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.graph.getNodeById(nodeId)!
        node.addCustomWidget({
          name: 'edge_counter',
          type: 'legacy_test',
          value: 0,
          options: {},
          y: 0,
          draw() {},
          mouse(this: { value: number; width?: number }, event, [x], host) {
            if (event.type !== 'pointerdown') return false
            if (x > (this.width || host.size[0]) - 30) this.value++
            return true
          }
        })
        node.pos = [40, 40]
        node.setSize([480, node.size[1]])
        window.app!.canvas.ds.offset = [0, 0]
        window.app!.canvas.ds.scale = 1
        window.app!.canvas.selectNode(node)
        window.app!.canvas.setDirty(true, true)
      }, nodeId)
      await comfyPage.nextFrame()
      const panel = new PropertiesPanel(comfyPage.page)
      await panel.open(comfyPage.actionbar.propertiesButton)
      await panel.searchWidgets('edge_counter')
      await expect(
        panel.root.getByTestId(TestIds.widgets.legacyCanvas)
      ).toBeVisible()

      await comfyPage.menu.topbar.setVueNodesEnabled(false)
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
      await comfyPage.nextFrame()

      const readValue = () =>
        comfyPage.page.evaluate(
          (nodeId) =>
            window
              .app!.graph.getNodeById(nodeId)!
              .widgets!.find((widget) => widget.name === 'edge_counter')!.value,
          nodeId
        )
      const rightEdge = await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.graph.getNodeById(nodeId)!
        const widget = node.widgets!.find(
          (candidate) => candidate.name === 'edge_counter'
        )!
        return window.app!.canvasPosToClientPos([
          node.pos[0] + node.size[0] - 15,
          node.pos[1] + widget.y + 10
        ])
      }, nodeId)
      await comfyPage.page.mouse.click(rightEdge[0], rightEdge[1])

      await expect.poll(readValue).toBe(1)
    })
  }
)
