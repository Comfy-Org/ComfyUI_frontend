import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'
import type { ComfyPage } from '../../../../fixtures/ComfyPage'
import type { Position } from '../../../../fixtures/types'

test.describe('Vue Node Moving', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  const getLoadCheckpointHeaderPos = async (comfyPage: ComfyPage) => {
    const loadCheckpointHeaderPos = await comfyPage.page
      .getByText('Load Checkpoint')
      .boundingBox()

    if (!loadCheckpointHeaderPos)
      throw new Error('Load Checkpoint header not found')

    return loadCheckpointHeaderPos
  }

  const expectPosChanged = async (pos1: Position, pos2: Position) => {
    const diffX = Math.abs(pos2.x - pos1.x)
    const diffY = Math.abs(pos2.y - pos1.y)
    expect(diffX).toBeGreaterThan(0)
    expect(diffY).toBeGreaterThan(0)
  }

  test(
    'should allow moving nodes by dragging',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const loadCheckpointHeaderPos =
        await getLoadCheckpointHeaderPos(comfyPage)
      await comfyPage.canvasOps.dragAndDrop(loadCheckpointHeaderPos, {
        x: 256,
        y: 256
      })

      const newHeaderPos = await getLoadCheckpointHeaderPos(comfyPage)
      await expectPosChanged(loadCheckpointHeaderPos, newHeaderPos)

      await expect(comfyPage.canvas).toHaveScreenshot('vue-node-moved-node.png')
    }
  )

  test('should not move node when pointer moves less than drag threshold', async ({
    comfyPage
  }) => {
    const headerPos = await getLoadCheckpointHeaderPos(comfyPage)

    // Move only 2px — below the 3px drag threshold in useNodePointerInteractions
    await comfyPage.page.mouse.move(headerPos.x, headerPos.y)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(headerPos.x + 2, headerPos.y + 1, {
      steps: 5
    })
    await comfyPage.page.mouse.up()
    await comfyPage.nextFrame()

    const afterPos = await getLoadCheckpointHeaderPos(comfyPage)
    expect(afterPos.x).toBeCloseTo(headerPos.x, 0)
    expect(afterPos.y).toBeCloseTo(headerPos.y, 0)

    // The small movement should have selected the node, not dragged it
    expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)
  })

  test('should move node when pointer moves beyond drag threshold', async ({
    comfyPage
  }) => {
    const headerPos = await getLoadCheckpointHeaderPos(comfyPage)

    // Move 50px — well beyond the 3px drag threshold
    await comfyPage.page.mouse.move(headerPos.x, headerPos.y)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(headerPos.x + 50, headerPos.y + 50, {
      steps: 20
    })
    await comfyPage.page.mouse.up()
    await comfyPage.nextFrame()

    const afterPos = await getLoadCheckpointHeaderPos(comfyPage)
    await expectPosChanged(headerPos, afterPos)
  })

  test(
    '@mobile should allow moving nodes by dragging on touch devices',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      // Disable minimap (gets in way of the node on small screens)
      await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)

      const loadCheckpointHeaderPos =
        await getLoadCheckpointHeaderPos(comfyPage)
      await comfyPage.canvasOps.panWithTouch(
        {
          x: 64,
          y: 64
        },
        loadCheckpointHeaderPos
      )

      const newHeaderPos = await getLoadCheckpointHeaderPos(comfyPage)
      await expectPosChanged(loadCheckpointHeaderPos, newHeaderPos)

      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-moved-node-touch.png'
      )
    }
  )
})
