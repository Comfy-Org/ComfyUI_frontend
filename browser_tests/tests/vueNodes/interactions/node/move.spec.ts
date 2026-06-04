import type { Locator } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position } from '@e2e/fixtures/types'

test.describe('Vue Node Moving', { tag: '@vue-nodes' }, () => {
  const getHeaderPos = async (
    comfyPage: ComfyPage,
    title: string
  ): Promise<{ x: number; y: number; width: number; height: number }> => {
    const box = await comfyPage.vueNodes
      .getNodeByTitle(title)
      .getByTestId('node-title')
      .first()
      .boundingBox()
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

  const dragFromTabButton = async (comfyPage: ComfyPage, button: Locator) => {
    const box = await button.boundingBox()
    if (!box) throw new Error('Tab button has no bounding box')
    const start = {
      x: box.x + box.width / 2,
      y: box.y + box.height * 0.75
    }
    await comfyPage.canvasOps.dragAndDrop(start, {
      x: start.x + 120,
      y: start.y + 80
    })
  }

  const advancedButtonOverflowPx = 24
  const holdPointCanvasInsetPx = 8

  const getAdvancedInputsButton = (node: Locator) =>
    node.getByTestId('advanced-inputs-button')

  const moveAdvancedButtonRightEdgePastCanvas = async (
    comfyPage: ComfyPage,
    button: Locator,
    overflow: number
  ) => {
    const box = await button.boundingBox()
    const canvasBox = await comfyPage.canvas.boundingBox()
    if (!box) throw new Error('Advanced button has no bounding box')
    if (!canvasBox) throw new Error('Canvas has no bounding box')

    const scale = await comfyPage.canvasOps.getScale()
    const deltaX = canvasBox.x + canvasBox.width + overflow - box.x - box.width
    await comfyPage.page.evaluate(
      ({ deltaX, scale }) => {
        const canvas = window.app!.canvas
        canvas.ds.offset[0] += deltaX / scale
        canvas.setDirty(true, true)
      },
      { deltaX, scale }
    )
    await comfyPage.idleFrames(2)
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
    await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)
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

  test('should not toggle advanced inputs when dragging by the Advanced button', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Node.AlwaysShowAdvancedWidgets',
      false
    )
    await comfyPage.nodeOps.addNode(
      'ModelSamplingFlux',
      {},
      {
        x: 500,
        y: 200
      }
    )
    await comfyPage.vueNodes.waitForNodes()

    const node = comfyPage.vueNodes.getNodeByTitle('ModelSamplingFlux')
    const showButton = getAdvancedInputsButton(node)
    const widgets = node.locator('.lg-node-widget')

    await expect(showButton).toBeVisible()
    await expect(widgets).toHaveCount(2)

    const beforePos = await node.boundingBox()
    if (!beforePos) throw new Error('Node has no bounding box')

    await dragFromTabButton(comfyPage, showButton)

    await expect(showButton).toBeVisible()
    await expect(node.getByText('Hide advanced inputs')).toBeHidden()
    await expect(widgets).toHaveCount(2)

    const afterPos = await node.boundingBox()
    if (!afterPos) throw new Error('Node missing after drag')
    await expectPosChanged(beforePos, afterPos)
  })

  test(
    'should not pan while holding the Advanced button without dragging',
    { tag: ['@canvas', '@widget'] },
    async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Node.AlwaysShowAdvancedWidgets',
        false
      )
      await comfyPage.nodeOps.addNode(
        'ModelSamplingFlux',
        {},
        {
          x: 500,
          y: 200
        }
      )
      await comfyPage.vueNodes.waitForNodes()

      const node = comfyPage.vueNodes.getNodeByTitle('ModelSamplingFlux')
      const showButton = getAdvancedInputsButton(node)
      await expect(showButton).toBeVisible()

      await moveAdvancedButtonRightEdgePastCanvas(
        comfyPage,
        showButton,
        advancedButtonOverflowPx
      )

      const buttonBox = await showButton.boundingBox()
      const canvasBox = await comfyPage.canvas.boundingBox()
      if (!buttonBox) throw new Error('Advanced button has no bounding box')
      if (!canvasBox) throw new Error('Canvas has no bounding box')

      const canvasRight = canvasBox.x + canvasBox.width
      const buttonRight = buttonBox.x + buttonBox.width
      expect(
        buttonRight,
        'Advanced button should extend past the canvas right edge'
      ).toBeGreaterThan(canvasRight)

      const holdPoint = {
        x: canvasRight - holdPointCanvasInsetPx,
        y: buttonBox.y + buttonBox.height / 2
      }
      expect(
        holdPoint.x,
        'Hold point should stay inside the visible part of the Advanced button'
      ).toBeGreaterThanOrEqual(buttonBox.x)
      expect(
        holdPoint.x,
        'Hold point should stay inside the visible canvas'
      ).toBeLessThanOrEqual(canvasRight)
      expect(
        holdPoint.y,
        'Hold point should stay inside the Advanced button height'
      ).toBeGreaterThanOrEqual(buttonBox.y)
      expect(
        holdPoint.y,
        'Hold point should stay inside the Advanced button height'
      ).toBeLessThanOrEqual(buttonBox.y + buttonBox.height)

      const beforeOffset = await comfyPage.canvasOps.getOffset()

      await comfyPage.page.mouse.move(holdPoint.x, holdPoint.y)
      await comfyPage.page.mouse.down()
      try {
        await comfyPage.idleFrames(8)
      } finally {
        await comfyPage.page.mouse.up()
      }

      const afterOffset = await comfyPage.canvasOps.getOffset()
      expect(afterOffset[0]).toBeCloseTo(beforeOffset[0], 3)
      expect(afterOffset[1]).toBeCloseTo(beforeOffset[1], 3)
    }
  )

  test('should not enter subgraph when dragging by the Enter Subgraph button', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

    const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
    const beforePos = await subgraphNode.getPosition()

    await dragFromTabButton(
      comfyPage,
      comfyPage.vueNodes.getSubgraphEnterButton('2')
    )

    expect(await comfyPage.subgraph.isInSubgraph()).toBe(false)

    const afterPos = await subgraphNode.getPosition()
    await expectPosChanged(beforePos, afterPos)
  })

  test('should move all selected nodes together when dragging one with Meta held', async ({
    comfyPage
  }) => {
    const checkpointBefore = await getHeaderPos(comfyPage, 'Load Checkpoint')
    const ksamplerBefore = await getHeaderPos(comfyPage, 'KSampler')
    const latentBefore = await getHeaderPos(comfyPage, 'Empty Latent Image')

    const dx = 120
    const dy = 80

    const clickNodeTitleWithMeta = async (title: string) => {
      await comfyPage.vueNodes
        .getNodeByTitle(title)
        .getByTestId('node-title')
        .first()
        .click({ modifiers: ['Meta'] })
    }

    await comfyPage.page.keyboard.down('Meta')
    try {
      await clickNodeTitleWithMeta('Load Checkpoint')
      await clickNodeTitleWithMeta('KSampler')
      await clickNodeTitleWithMeta('Empty Latent Image')
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(3)

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

    await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(3)

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
      expect(newHeaderPos.x).toBeCloseTo(loadCheckpointHeaderPos.x + 64)
      expect(newHeaderPos.y).toBeCloseTo(loadCheckpointHeaderPos.y + 64)
    }
  )
})
