import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position } from '@e2e/fixtures/types'

test.describe('Vue Node Moving', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  const getHeaderPos = async (comfyPage: ComfyPage, title: string) => {
    const box = await comfyPage.page.getByText(title).boundingBox()
    if (!box) throw new Error(`${title} header not found`)
    return box
  }

  const getLoadCheckpointHeaderPos = async (comfyPage: ComfyPage) =>
    getHeaderPos(comfyPage, 'Load Checkpoint')

  const expectPosChanged = async (pos1: Position, pos2: Position) => {
    const diffX = Math.abs(pos2.x - pos1.x)
    const diffY = Math.abs(pos2.y - pos1.y)
    expect(diffX).toBeGreaterThan(0)
    expect(diffY).toBeGreaterThan(0)
  }

  const deltaBetween = (before: Position, after: Position) => ({
    x: after.x - before.x,
    y: after.y - before.y
  })

  const expectSameDelta = (a: Position, b: Position, tol = 2) => {
    expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(tol)
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(tol)
  }

  test('should allow moving nodes by dragging', async ({ comfyPage }) => {
    const loadCheckpointHeaderPos = await getLoadCheckpointHeaderPos(comfyPage)
    await comfyPage.canvasOps.dragAndDrop(loadCheckpointHeaderPos, {
      x: 256,
      y: 256
    })

    const newHeaderPos = await getLoadCheckpointHeaderPos(comfyPage)
    await expectPosChanged(loadCheckpointHeaderPos, newHeaderPos)
  })

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

  test('should move all selected nodes together when dragging one with Meta held', async ({
    comfyPage
  }) => {
    const checkpointBefore = await getHeaderPos(comfyPage, 'Load Checkpoint')
    const ksamplerBefore = await getHeaderPos(comfyPage, 'KSampler')
    const latentBefore = await getHeaderPos(comfyPage, 'Empty Latent Image')

    const dx = 120
    const dy = 80

    await comfyPage.page.keyboard.down('Meta')
    try {
      await comfyPage.page
        .getByText('Load Checkpoint')
        .click({ modifiers: ['Meta'] })
      await comfyPage.page.getByText('KSampler').click({ modifiers: ['Meta'] })
      await comfyPage.page
        .getByText('Empty Latent Image')
        .click({ modifiers: ['Meta'] })
      await expect.poll(() => comfyPage.vueNodes.getSelectedNodeCount()).toBe(3)

      // Re-fetch drag source after clicks in case the header reflowed.
      const dragSrc = await getHeaderPos(comfyPage, 'Load Checkpoint')
      const centerX = dragSrc.x + dragSrc.width / 2
      const centerY = dragSrc.y + dragSrc.height / 2

      await comfyPage.page.mouse.move(centerX, centerY)
      await comfyPage.page.mouse.down()
      await comfyPage.nextFrame()
      await comfyPage.page.mouse.move(centerX + dx, centerY + dy, {
        steps: 20
      })
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()
    } finally {
      await comfyPage.page.keyboard.up('Meta')
      await comfyPage.nextFrame()
    }

    await expect.poll(() => comfyPage.vueNodes.getSelectedNodeCount()).toBe(3)

    const checkpointAfter = await getHeaderPos(comfyPage, 'Load Checkpoint')
    const ksamplerAfter = await getHeaderPos(comfyPage, 'KSampler')
    const latentAfter = await getHeaderPos(comfyPage, 'Empty Latent Image')

    // All three nodes should have moved together by the same delta.
    // We don't assert the exact screen delta equals the dragged pixel delta,
    // because canvas scaling and snap-to-grid can introduce offsets.
    const checkpointDelta = deltaBetween(checkpointBefore, checkpointAfter)
    const ksamplerDelta = deltaBetween(ksamplerBefore, ksamplerAfter)
    const latentDelta = deltaBetween(latentBefore, latentAfter)

    // Confirm an actual drag happened (not zero movement).
    expect(Math.abs(checkpointDelta.x)).toBeGreaterThan(10)
    expect(Math.abs(checkpointDelta.y)).toBeGreaterThan(10)

    // Confirm all selected nodes moved by the same delta.
    expectSameDelta(checkpointDelta, ksamplerDelta)
    expectSameDelta(checkpointDelta, latentDelta)

    await comfyPage.canvasOps.moveMouseToEmptyArea()
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
