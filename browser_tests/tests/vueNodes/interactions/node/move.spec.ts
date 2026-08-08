import type { Locator } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position } from '@e2e/fixtures/types'
import { findEmptyCanvasPoint } from '@e2e/fixtures/utils/findEmptyCanvasPoint'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

const CREATE_GROUP_HOTKEY = 'Control+g'

test.describe('Vue Node Moving', { tag: '@vue-nodes' }, () => {
  const getHeaderBounds = async (comfyPage: ComfyPage, title: string) => {
    const box = await comfyPage.vueNodes
      .getNodeByTitle(title)
      .getByTestId('node-title')
      .first()
      .boundingBox()
    if (!box) throw new Error(`${title} header not found`)
    return box
  }

  const getHeaderPos = async (
    comfyPage: ComfyPage,
    title: string
  ): Promise<{ x: number; y: number }> => {
    const box = await getHeaderBounds(comfyPage, title)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
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

  const expectSlotPositionTracksDom = async (
    comfyPage: ComfyPage,
    nodeId: NodeId,
    slotIndex: number,
    isInput: boolean
  ) => {
    const slotKey = getSlotKey(nodeId, slotIndex, isInput)

    await expect(async () => {
      const positions = await comfyPage.page.evaluate(
        ({ nodeId, slotIndex, isInput, slotKey }) => {
          const app = window.app!
          const node = app.graph.getNodeById(nodeId)
          const slot = document.querySelector<HTMLElement>(
            `[data-slot-key="${slotKey}"]`
          )
          if (!node || !slot) return null

          const graphPosition = isInput
            ? node.getInputPos(slotIndex)
            : node.getOutputPos(slotIndex)
          const [linkX, linkY] = app.canvasPosToClientPos(graphPosition)
          const slotBounds = slot.getBoundingClientRect()

          return {
            link: { x: linkX, y: linkY },
            slot: {
              x: slotBounds.x + slotBounds.width / 2,
              y: slotBounds.y + slotBounds.height / 2
            }
          }
        },
        { nodeId, slotIndex, isInput, slotKey }
      )
      expect(
        positions,
        'Link and DOM slot positions should resolve'
      ).not.toBeNull()
      expect(Math.abs(positions!.link.x - positions!.slot.x)).toBeLessThan(2)
      expect(Math.abs(positions!.link.y - positions!.slot.y)).toBeLessThan(2)
    }).toPass({ timeout: 5000 })
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

  const armPointerCaptureTracking = async (comfyPage: ComfyPage) => {
    await comfyPage.page.evaluate(() => {
      window.addEventListener(
        'pointerdown',
        (event) => {
          document.documentElement.dataset.dragTestPointerId = String(
            event.pointerId
          )
        },
        { capture: true, once: true }
      )
    })
  }

  const releaseActivePointerCapture = async (comfyPage: ComfyPage) => {
    const released = await comfyPage.page.evaluate(() => {
      const pointerId = Number(
        document.documentElement.dataset.dragTestPointerId
      )
      if (!Number.isInteger(pointerId)) return false

      const elements = [
        document.documentElement,
        ...document.querySelectorAll<HTMLElement>('*')
      ]
      const captureOwner = elements.find((element) =>
        element.hasPointerCapture(pointerId)
      )
      if (!captureOwner) return false

      captureOwner.releasePointerCapture(pointerId)
      return true
    })

    expect(released, 'A DOM element should own pointer capture').toBe(true)
  }

  const getDistantVisibleNode = async (
    comfyPage: ComfyPage,
    source: { x: number; y: number; width: number; height: number },
    sourceNodeId: string
  ) => {
    return await comfyPage.page.evaluate(
      ({ source, sourceNodeId }) => {
        const sourceCenter = {
          x: source.x + source.width / 2,
          y: source.y + source.height / 2
        }

        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>('[data-node-id]')
        ).flatMap((node) => {
          if (node.dataset.nodeId === sourceNodeId) return []

          const title = node.querySelector<HTMLElement>(
            '[data-testid="node-title"]'
          )
          if (!title) return []

          const bounds = title.getBoundingClientRect()
          const center = {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2
          }
          const distance = Math.hypot(
            center.x - sourceCenter.x,
            center.y - sourceCenter.y
          )
          if (
            document
              .elementFromPoint(center.x, center.y)
              ?.closest('[data-node-id]') !== node
          ) {
            return []
          }

          return [
            {
              nodeId: node.dataset.nodeId,
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
              distance
            }
          ]
        })

        const target = candidates.toSorted((a, b) => b.distance - a.distance)[0]
        const nodeId = target?.nodeId
        if (!nodeId) throw new Error('No visible target node found')
        return { ...target, nodeId }
      },
      { source, sourceNodeId }
    )
  }

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

  test('should allow moving nodes by dragging', async ({
    comfyPage,
    comfyMouse
  }) => {
    const initialHeaderPos = await getLoadCheckpointHeaderPos(comfyPage)
    const node = await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
    await comfyMouse.dragElementBy(node.header, { x: 100, y: 100 })

    const newHeaderPos = await getLoadCheckpointHeaderPos(comfyPage)
    await expectPosChanged(initialHeaderPos, newHeaderPos)
  })

  test('should not move node when pointer moves less than drag threshold', async ({
    comfyPage,
    comfyMouse
  }) => {
    const headerPos = await getLoadCheckpointHeaderPos(comfyPage)

    // Move only 2px — below the 3px drag threshold in useNodePointerInteractions
    const node = await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
    await comfyMouse.dragElementBy(node.header, { x: 2, y: 1 })
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

  test('keeps drag ownership after pointer capture is lost', async ({
    comfyPage
  }) => {
    const sourceBefore = await getHeaderBounds(comfyPage, 'KSampler')
    const sourceNodeId = await comfyPage.vueNodes.getNodeIdByTitle('KSampler')
    const targetBefore = await getDistantVisibleNode(
      comfyPage,
      sourceBefore,
      sourceNodeId
    )
    const targetTitle = comfyPage.vueNodes
      .getNodeLocator(targetBefore.nodeId)
      .getByTestId('node-title')
    const sourceStart = {
      x: sourceBefore.x + sourceBefore.width / 2,
      y: sourceBefore.y + sourceBefore.height / 2
    }
    const targetCenter = {
      x: targetBefore.x + targetBefore.width / 2,
      y: targetBefore.y + targetBefore.height / 2
    }
    await armPointerCaptureTracking(comfyPage)
    await comfyPage.page.mouse.move(sourceStart.x, sourceStart.y)
    await comfyPage.page.mouse.down()
    try {
      await comfyPage.page.mouse.move(sourceStart.x + 10, sourceStart.y + 10, {
        steps: 5
      })
      await comfyPage.nextFrame()
      await releaseActivePointerCapture(comfyPage)

      await comfyPage.page.mouse.move(targetCenter.x, targetCenter.y, {
        steps: 1
      })
      await comfyPage.nextFrame()
      await releaseActivePointerCapture(comfyPage)

      const releasePoint = await findEmptyCanvasPoint(comfyPage.canvas)
      await comfyPage.page.mouse.move(releasePoint.x, releasePoint.y)
    } finally {
      await comfyPage.page.mouse.up()
    }
    await comfyPage.nextFrame()

    const sourceAfterRelease = await getHeaderBounds(comfyPage, 'KSampler')
    const targetAfterRelease = await targetTitle.boundingBox()
    if (!targetAfterRelease) throw new Error('Target node header not found')

    await expectPosChanged(sourceBefore, sourceAfterRelease)
    expectSameDelta(targetAfterRelease, targetBefore)

    await comfyPage.page.mouse.move(targetCenter.x + 20, targetCenter.y + 20, {
      steps: 5
    })
    await comfyPage.nextFrame()

    const sourceFinal = await getHeaderBounds(comfyPage, 'KSampler')
    const targetFinal = await targetTitle.boundingBox()
    if (!targetFinal) throw new Error('Target node header not found')
    expectSameDelta(sourceFinal, sourceAfterRelease)
    expectSameDelta(targetFinal, targetAfterRelease)
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
      const headerPos = await getHeaderPos(comfyPage, 'Load Checkpoint')

      await comfyPage.page.mouse.move(headerPos.x, headerPos.y)
      await comfyPage.page.mouse.down()
      await comfyPage.nextFrame()
      await comfyPage.page.mouse.move(headerPos.x + dx, headerPos.y + dy, {
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

  test('keeps link geometry attached while dragging a collapsed node', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    const node = await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
    const rawNodeId = await node.root.getAttribute('data-node-id')
    if (!rawNodeId) throw new Error('Load Checkpoint node ID not found')
    const nodeId = toNodeId(rawNodeId)

    await node.select()
    await comfyPage.command.executeCommand(
      'Comfy.Canvas.ToggleSelectedNodes.Collapse'
    )
    await expect(node.root).toHaveAttribute('data-collapsed', 'true')
    const nodeBounds = await node.boundingBox()
    if (!nodeBounds) throw new Error('Collapsed node bounds not found')

    const start = {
      x: nodeBounds.x + nodeBounds.width / 2,
      y: nodeBounds.y + nodeBounds.height / 2
    }
    await comfyPage.page.mouse.move(start.x, start.y)
    await comfyPage.page.mouse.down()
    try {
      await comfyPage.page.mouse.move(start.x + 120, start.y + 80, {
        steps: 10
      })
      await comfyPage.nextFrame()
      await expectSlotPositionTracksDom(comfyPage, nodeId, 0, false)
    } finally {
      await comfyPage.page.mouse.up()
    }
  })

  test('keeps link geometry attached while dragging a group', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    const checkpoint =
      await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
    const rawCheckpointId = await checkpoint.root.getAttribute('data-node-id')
    if (!rawCheckpointId) throw new Error('Load Checkpoint node ID not found')
    const checkpointId = toNodeId(rawCheckpointId)

    await checkpoint.header.click()
    const sampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await sampler.header.click({ modifiers: ['Control'] })
    await comfyPage.page.keyboard.press(CREATE_GROUP_HOTKEY)
    const titleInput = comfyPage.page.getByTestId('node-title-input')
    await titleInput.fill('Linked nodes')
    await titleInput.press('Enter')

    await expect
      .poll(() => comfyPage.canvasOps.getGroupPosition('Linked nodes'))
      .toBeTruthy()
    const groupPosition =
      await comfyPage.canvasOps.getGroupPosition('Linked nodes')
    const groupStart = await comfyPage.page.evaluate(({ x, y }) => {
      const [clientX, clientY] = window.app!.canvasPosToClientPos([
        x + 50,
        y + 15
      ])
      return { x: clientX, y: clientY }
    }, groupPosition)

    await comfyPage.page.mouse.move(groupStart.x, groupStart.y)
    await comfyPage.page.mouse.down()
    try {
      await comfyPage.page.mouse.move(groupStart.x + 120, groupStart.y + 80, {
        steps: 10
      })
      await comfyPage.nextFrame()
      await expectSlotPositionTracksDom(comfyPage, checkpointId, 0, false)
    } finally {
      await comfyPage.page.mouse.up()
    }
    await comfyPage.nextFrame()

    await expectSlotPositionTracksDom(comfyPage, checkpointId, 0, false)
  })

  test('pointerCancel stops autopan', async ({ comfyPage }) => {
    const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await ksampler.header.click({ trial: true })
    await comfyPage.page.mouse.down()

    const getOffset = () => comfyPage.canvasOps.getOffset()
    const initialOffset = await getOffset()
    await comfyPage.page.mouse.move(10, 10, { steps: 20 })
    await expect.poll(getOffset, 'drag with autopan').not.toEqual(initialOffset)

    await test.step('move outside pan range and cancel drag', async () => {
      await comfyPage.page.mouse.move(400, 400, { steps: 20 })
      await ksampler.header.evaluate((node) =>
        node.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }))
      )
    })

    const secondaryOffset = await getOffset()

    await comfyPage.page.mouse.move(10, 10, { steps: 20 })
    await comfyPage.nextFrame()
    expect(await getOffset(), 'drag canceled').toEqual(secondaryOffset)
  })

  test('dragging a node moves all selected items', async ({
    comfyPage,
    comfyMouse
  }) => {
    const samplerLocator = comfyPage.vueNodes.getNodeByTitle('KSampler')
    const ksampler = new VueNodeFixture(samplerLocator)
    const loaderLocator = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
    const loader = new VueNodeFixture(loaderLocator)

    await test.step('create graph with group and reroute', async () => {
      await comfyPage.nodeOps.clearGraph()
      await comfyPage.searchBoxV2.addNode('Load Checkpoint')
      const samplerOptions = { position: { x: 800, y: 200 } }
      await comfyPage.searchBoxV2.addNode('KSampler', samplerOptions)
      await ksampler.getSlot('model').dragTo(loader.getSlot('MODEL'))

      await test.step('add reroute', async () => {
        const b1 = await ksampler.getSlot('model').boundingBox()
        const b2 = await loader.getSlot('MODEL').boundingBox()
        if (!b1 || !b2) throw new Error('Failed to get bounds')

        const x = (b1.x + b2.x + (b1.width + b2.width) / 2) / 2
        const y = (b1.y + b2.y + (b1.height + b2.height) / 2) / 2
        await comfyPage.page.keyboard.down('Alt')
        await comfyPage.page.mouse.click(x, y)
        await comfyPage.page.keyboard.up('Alt')

        const rerouteCount = () =>
          comfyPage.page.evaluate(() => graph!.reroutes.size)
        await expect.poll(rerouteCount).toBe(1)
      })

      await comfyPage.keyboard.selectAll()
      await comfyPage.page.keyboard.press('Control+G')
      await comfyPage.keyboard.selectAll()
    })

    const getReroutePos = () =>
      comfyPage.page.evaluate(() => [...graph!.reroutes.values()][0])
    const getGroupPos = () =>
      comfyPage.page.evaluate(() => graph!.groups[0].pos)
    const initialReroutePos = await getReroutePos()
    const initialGroupPos = await getGroupPos()
    await comfyMouse.dragElementBy(ksampler.title, { x: 100 })

    await expect.poll(getReroutePos).not.toEqual(initialReroutePos)
    await expect.poll(getGroupPos).not.toEqual(initialGroupPos)
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
