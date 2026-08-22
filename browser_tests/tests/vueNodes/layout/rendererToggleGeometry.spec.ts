import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { toNodeId } from '@/types/nodeId'

test.describe('Renderer toggle geometry', { tag: ['@vue-nodes'] }, () => {
  test('slot geometry survives a Vue to legacy round trip', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')

    const nodeId = toNodeId(
      await comfyPage.vueNodes.getNodeIdByTitle('KSampler')
    )

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

    await expect
      .poll(async () => {
        const { size } = await comfyPage.canvasOps.getNodeGeometry(nodeId)
        return size
      })
      .toEqual(before.size)
    const moved = await comfyPage.canvasOps.getNodeGeometry(nodeId)
    comfyPage.canvasOps.expectSlotsTrackedNode(moved, before)

    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
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

    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()

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
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
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

      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.vueNodes.waitForNodes()
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
})
