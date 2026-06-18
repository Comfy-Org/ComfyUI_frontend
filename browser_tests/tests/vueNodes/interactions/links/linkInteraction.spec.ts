import type { Locator, Page } from '@playwright/test'

import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { getMiddlePoint } from '@e2e/fixtures/utils/litegraphUtils'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

async function getCenter(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Slot bounding box not available')
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  }
}

async function getInputLinkDetails(
  page: Page,
  nodeId: NodeId,
  slotIndex: number
) {
  return await page.evaluate(
    ([targetNodeId, targetSlot]) => {
      const app = window.app
      const graph = app?.canvas?.graph ?? app?.graph
      if (!graph) return null

      const node = graph.getNodeById(targetNodeId)
      if (!node) return null

      const input = node.inputs?.[targetSlot]
      if (!input) return null

      const linkId = input.link
      if (linkId == null) return null

      const link = graph.getLink?.(linkId)
      if (!link) return null

      return {
        id: link.id,
        originId: link.origin_id,
        originSlot:
          typeof link.origin_slot === 'string'
            ? Number.parseInt(link.origin_slot, 10)
            : link.origin_slot,
        targetId: link.target_id,
        targetSlot:
          typeof link.target_slot === 'string'
            ? Number.parseInt(link.target_slot, 10)
            : link.target_slot,
        parentId: link.parentId ?? null
      }
    },
    [nodeId, slotIndex] as const
  )
}

function slotLocator(
  page: Page,
  nodeId: NodeId,
  slotIndex: number,
  isInput: boolean
) {
  const key = getSlotKey(String(nodeId), slotIndex, isInput)
  return page.locator(`[data-slot-key="${key}"]`)
}

async function expectVisibleAll(...locators: Locator[]) {
  await Promise.all(locators.map((l) => expect(l).toBeVisible()))
}

async function getSlotCenter(
  page: Page,
  nodeId: NodeId,
  slotIndex: number,
  isInput: boolean
) {
  const locator = slotLocator(page, nodeId, slotIndex, isInput)
  await expect(locator).toBeVisible()
  return await getCenter(locator)
}

async function connectSlots(
  page: Page,
  from: { nodeId: NodeId; index: number },
  to: { nodeId: NodeId; index: number },
  nextFrame: () => Promise<void>
) {
  const fromLoc = slotLocator(page, from.nodeId, from.index, false)
  const toLoc = slotLocator(page, to.nodeId, to.index, true)
  await expectVisibleAll(fromLoc, toLoc)
  // oxlint-disable-next-line playwright/no-force-option -- Slot dot's parent wrapper div intercepts actionability check on inner dot
  await fromLoc.dragTo(toLoc, { force: true })
  await nextFrame()
}

test.describe(
  'Vue Node Link Interaction',
  { tag: ['@screenshot', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.NodeSearchBoxImpl', 'default')
      await comfyPage.workflow.loadWorkflow('vueNodes/simple-triple')
      await fitToViewInstant(comfyPage)
    })

    test('should show a link dragging out from a slot when dragging on a slot', async ({
      comfyPage,
      comfyMouse
    }) => {
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      expect(samplerNode).toBeTruthy()

      const slot = slotLocator(comfyPage.page, samplerNode.id, 0, false)
      await expect(slot).toBeVisible()

      const start = await getCenter(slot)

      // Arbitrary value
      const dragTarget = {
        x: start.x + 180,
        y: start.y - 140
      }

      await comfyMouse.move(start)
      await comfyMouse.drag(dragTarget)
      await comfyPage.nextFrame()

      try {
        await expect(comfyPage.canvas).toHaveScreenshot(
          'vue-node-dragging-link.png'
        )
      } finally {
        await comfyMouse.drop()
      }
    })

    test('should create a link when dropping on a compatible slot', async ({
      comfyPage
    }) => {
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      const vaeNode = (
        await comfyPage.nodeOps.getNodeRefsByType('VAEDecode')
      )[0]
      expect(samplerNode && vaeNode).toBeTruthy()

      const samplerOutput = await samplerNode.getOutput(0)
      const vaeInput = await vaeNode.getInput(0)

      await connectSlots(
        comfyPage.page,
        { nodeId: samplerNode.id, index: 0 },
        { nodeId: vaeNode.id, index: 0 },
        () => comfyPage.nextFrame()
      )

      await expect.poll(() => samplerOutput.getLinkCount()).toBe(1)
      await expect.poll(() => vaeInput.getLinkCount()).toBe(1)

      await expect
        .poll(() => getInputLinkDetails(comfyPage.page, vaeNode.id, 0))
        .toMatchObject({
          originId: samplerNode.id,
          originSlot: 0,
          targetId: vaeNode.id,
          targetSlot: 0
        })
    })

    test('should not create a link when slot types are incompatible', async ({
      comfyPage
    }) => {
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      const clipNode = (
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      )[0]
      expect(samplerNode && clipNode).toBeTruthy()

      const samplerOutput = await samplerNode.getOutput(0)
      const clipInput = await clipNode.getInput(0)

      const outputSlot = slotLocator(comfyPage.page, samplerNode.id, 0, false)
      const inputSlot = slotLocator(comfyPage.page, clipNode.id, 0, true)
      await expectVisibleAll(outputSlot, inputSlot)

      // oxlint-disable-next-line playwright/no-force-option -- Slot dot's parent wrapper div intercepts actionability check on inner dot
      await outputSlot.dragTo(inputSlot, { force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => samplerOutput.getLinkCount()).toBe(0)
      await expect.poll(() => clipInput.getLinkCount()).toBe(0)

      await expect
        .poll(() => getInputLinkDetails(comfyPage.page, clipNode.id, 0))
        .toBeNull()
    })

    test('should not create a link when dropping onto a slot on the same node', async ({
      comfyPage
    }) => {
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      expect(samplerNode).toBeTruthy()

      const samplerOutput = await samplerNode.getOutput(0)
      const samplerInput = await samplerNode.getInput(3)

      const outputSlot = slotLocator(comfyPage.page, samplerNode.id, 0, false)
      const inputSlot = slotLocator(comfyPage.page, samplerNode.id, 3, true)
      await expectVisibleAll(outputSlot, inputSlot)

      // oxlint-disable-next-line playwright/no-force-option -- Slot dot's parent wrapper div intercepts actionability check on inner dot
      await outputSlot.dragTo(inputSlot, { force: true })
      await comfyPage.nextFrame()

      await expect.poll(() => samplerOutput.getLinkCount()).toBe(0)
      await expect.poll(() => samplerInput.getLinkCount()).toBe(0)
    })

    test('should reuse the existing origin when dragging an input link', async ({
      comfyPage,
      comfyMouse
    }) => {
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      const vaeNode = (
        await comfyPage.nodeOps.getNodeRefsByType('VAEDecode')
      )[0]
      expect(samplerNode && vaeNode).toBeTruthy()
      const samplerOutputCenter = await getSlotCenter(
        comfyPage.page,
        samplerNode.id,
        0,
        false
      )
      const vaeInputCenter = await getSlotCenter(
        comfyPage.page,
        vaeNode.id,
        0,
        true
      )

      await comfyMouse.move(samplerOutputCenter)
      await comfyMouse.drag(vaeInputCenter)
      await comfyMouse.drop()

      const dragTarget = {
        x: vaeInputCenter.x + 160,
        y: vaeInputCenter.y - 100
      }

      await comfyMouse.move(vaeInputCenter)
      await comfyMouse.drag(dragTarget)
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-input-drag-reuses-origin.png'
      )
      await comfyMouse.drop()
    })

    test('ctrl+alt drag from an input starts a fresh link', async ({
      comfyPage,
      comfyMouse
    }) => {
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      const vaeNode = (
        await comfyPage.nodeOps.getNodeRefsByType('VAEDecode')
      )[0]
      expect(samplerNode && vaeNode).toBeTruthy()

      const samplerOutput = await samplerNode.getOutput(0)
      const vaeInput = await vaeNode.getInput(0)

      const samplerOutputCenter = await getSlotCenter(
        comfyPage.page,
        samplerNode.id,
        0,
        false
      )
      const vaeInputCenter = await getSlotCenter(
        comfyPage.page,
        vaeNode.id,
        0,
        true
      )

      await comfyMouse.move(samplerOutputCenter)
      await comfyMouse.drag(vaeInputCenter)
      await comfyMouse.drop()

      await comfyPage.nextFrame()

      const dragTarget = {
        x: vaeInputCenter.x + 140,
        y: vaeInputCenter.y - 110
      }

      await comfyMouse.move(vaeInputCenter)
      await comfyPage.page.keyboard.down('Control')
      await comfyPage.page.keyboard.down('Alt')

      try {
        await comfyMouse.drag(dragTarget)
        await expect(comfyPage.canvas).toHaveScreenshot(
          'vue-node-input-drag-ctrl-alt.png'
        )
      } finally {
        await comfyMouse.drop().catch(() => {})
        await comfyPage.page.keyboard.up('Alt').catch(() => {})
        await comfyPage.page.keyboard.up('Control').catch(() => {})
      }

      await comfyPage.nextFrame()

      // Technically intended to disconnect existing as well
      await expect.poll(() => vaeInput.getLinkCount()).toBe(0)
      await expect.poll(() => samplerOutput.getLinkCount()).toBe(0)
    })

    test('dropping an input link back on its slot restores the original connection', async ({
      comfyPage,
      comfyMouse
    }) => {
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      const vaeNode = (
        await comfyPage.nodeOps.getNodeRefsByType('VAEDecode')
      )[0]
      expect(samplerNode && vaeNode).toBeTruthy()

      const samplerOutput = await samplerNode.getOutput(0)
      const vaeInput = await vaeNode.getInput(0)

      const samplerOutputCenter = await getSlotCenter(
        comfyPage.page,
        samplerNode.id,
        0,
        false
      )
      const vaeInputCenter = await getSlotCenter(
        comfyPage.page,
        vaeNode.id,
        0,
        true
      )

      await comfyMouse.move(samplerOutputCenter)
      try {
        await comfyMouse.drag(vaeInputCenter)
      } finally {
        await comfyMouse.drop()
      }

      await expect
        .poll(() => getInputLinkDetails(comfyPage.page, vaeNode.id, 0))
        .not.toBeNull()

      const originalLink = await getInputLinkDetails(
        comfyPage.page,
        vaeNode.id,
        0
      )

      const dragTarget = {
        x: vaeInputCenter.x + 150,
        y: vaeInputCenter.y - 100
      }

      // To prevent needing a screenshot expectation for whether the link's off
      const vaeInputLocator = slotLocator(comfyPage.page, vaeNode.id, 0, true)
      await expect
        .poll(async () => {
          const inputBox = await vaeInputLocator.boundingBox()
          if (!inputBox) return false
          const isOutsideX =
            dragTarget.x < inputBox.x ||
            dragTarget.x > inputBox.x + inputBox.width
          const isOutsideY =
            dragTarget.y < inputBox.y ||
            dragTarget.y > inputBox.y + inputBox.height
          return isOutsideX || isOutsideY
        })
        .toBe(true)

      await comfyMouse.move(vaeInputCenter)
      await comfyMouse.drag(dragTarget)
      await comfyMouse.move(vaeInputCenter)
      await comfyMouse.drop()

      await expect
        .poll(() => getInputLinkDetails(comfyPage.page, vaeNode.id, 0))
        .toMatchObject({
          originId: originalLink!.originId,
          originSlot: originalLink!.originSlot,
          targetId: originalLink!.targetId,
          targetSlot: originalLink!.targetSlot,
          parentId: originalLink!.parentId
        })
      await expect.poll(() => samplerOutput.getLinkCount()).toBe(1)
      await expect.poll(() => vaeInput.getLinkCount()).toBe(1)
    })

    test('rerouted input drag preview remains anchored to reroute', async ({
      comfyPage,
      comfyMouse
    }) => {
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      const vaeNode = (
        await comfyPage.nodeOps.getNodeRefsByType('VAEDecode')
      )[0]

      const samplerOutput = await samplerNode.getOutput(0)
      const vaeInput = await vaeNode.getInput(0)

      await connectSlots(
        comfyPage.page,
        { nodeId: samplerNode.id, index: 0 },
        { nodeId: vaeNode.id, index: 0 },
        () => comfyPage.nextFrame()
      )

      const outputPosition = await samplerOutput.getPosition()
      const inputPosition = await vaeInput.getPosition()
      const reroutePoint = getMiddlePoint(outputPosition, inputPosition)

      // Insert a reroute programmatically on the existing link between sampler output[0] and VAE input[0].
      // This avoids relying on an exact path hit-test position.
      await comfyPage.page.evaluate(
        ([targetNodeId, targetSlot, clientPoint]) => {
          const app = window.app
          const graph = app?.canvas?.graph ?? app?.graph
          if (!graph) throw new Error('Graph not available')
          const node = graph.getNodeById(targetNodeId)
          if (!node) throw new Error('Target node not found')
          const input = node.inputs?.[targetSlot]
          if (!input) throw new Error('Target input slot not found')

          const linkId = input.link
          if (linkId == null) throw new Error('Expected existing link on input')
          const link = graph.getLink(linkId)
          if (!link) throw new Error('Link not found')

          // Convert the client/canvas pixel coordinates to graph space
          const pos = app!.canvas.ds.convertCanvasToOffset([
            clientPoint.x,
            clientPoint.y
          ])
          graph.createReroute(pos, link)
        },
        [vaeNode.id, 0, reroutePoint] as const
      )

      await comfyPage.nextFrame()

      const vaeInputCenter = await getSlotCenter(
        comfyPage.page,
        vaeNode.id,
        0,
        true
      )
      const dragTarget = {
        x: vaeInputCenter.x + 160,
        y: vaeInputCenter.y - 120
      }

      let dropped = false
      try {
        await comfyMouse.move(vaeInputCenter)
        await comfyMouse.drag(dragTarget)
        await expect(comfyPage.canvas).toHaveScreenshot(
          'vue-node-reroute-input-drag.png'
        )
        await comfyMouse.move(vaeInputCenter)
        await comfyMouse.drop()
        dropped = true
      } finally {
        if (!dropped) {
          await comfyMouse.drop().catch(() => {})
        }
      }

      await expect
        .poll(() => getInputLinkDetails(comfyPage.page, vaeNode.id, 0))
        .toMatchObject({
          originId: samplerNode.id
        })
      await expect
        .poll(async () => {
          const link = await getInputLinkDetails(comfyPage.page, vaeNode.id, 0)
          return link?.parentId
        })
        .not.toBeNull()
    })

    test('rerouted output shift-drag preview remains anchored to reroute', async ({
      comfyPage,
      comfyMouse
    }) => {
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      const vaeNode = (
        await comfyPage.nodeOps.getNodeRefsByType('VAEDecode')
      )[0]
      expect(samplerNode && vaeNode).toBeTruthy()

      const samplerOutput = await samplerNode.getOutput(0)
      const vaeInput = await vaeNode.getInput(0)

      await connectSlots(
        comfyPage.page,
        { nodeId: samplerNode.id, index: 0 },
        { nodeId: vaeNode.id, index: 0 },
        () => comfyPage.nextFrame()
      )

      const outputPosition = await samplerOutput.getPosition()
      const inputPosition = await vaeInput.getPosition()
      const reroutePoint = getMiddlePoint(outputPosition, inputPosition)

      // Insert a reroute programmatically on the existing link between sampler output[0] and VAE input[0].
      // This avoids relying on an exact path hit-test position.
      await comfyPage.page.evaluate(
        ([targetNodeId, targetSlot, clientPoint]) => {
          const app = window.app
          const graph = app?.canvas?.graph ?? app?.graph
          if (!graph) throw new Error('Graph not available')
          const node = graph.getNodeById(targetNodeId)
          if (!node) throw new Error('Target node not found')
          const input = node.inputs?.[targetSlot]
          if (!input) throw new Error('Target input slot not found')

          const linkId = input.link
          if (linkId == null) throw new Error('Expected existing link on input')
          const link = graph.getLink(linkId)
          if (!link) throw new Error('Link not found')

          // Convert the client/canvas pixel coordinates to graph space
          const pos = app!.canvas.ds.convertCanvasToOffset([
            clientPoint.x,
            clientPoint.y
          ])
          graph.createReroute(pos, link)
        },
        [vaeNode.id, 0, reroutePoint] as const
      )

      await comfyPage.nextFrame()

      const outputCenter = await getSlotCenter(
        comfyPage.page,
        samplerNode.id,
        0,
        false
      )
      const dragTarget = {
        x: outputCenter.x + 150,
        y: outputCenter.y - 140
      }

      let dropPending = false
      let shiftHeld = false
      try {
        await comfyMouse.move(outputCenter)
        await comfyPage.page.keyboard.down('Shift')
        shiftHeld = true
        dropPending = true
        await comfyMouse.drag(dragTarget)
        await expect(comfyPage.canvas).toHaveScreenshot(
          'vue-node-reroute-output-shift-drag.png'
        )
        await comfyMouse.move(outputCenter)
        await comfyMouse.drop()
        dropPending = false
      } finally {
        if (dropPending) await comfyMouse.drop().catch(() => {})
        if (shiftHeld) await comfyPage.page.keyboard.up('Shift').catch(() => {})
      }

      await expect
        .poll(() => getInputLinkDetails(comfyPage.page, vaeNode.id, 0))
        .toMatchObject({
          originId: samplerNode.id
        })
      await expect
        .poll(async () => {
          const link = await getInputLinkDetails(comfyPage.page, vaeNode.id, 0)
          return link?.parentId
        })
        .not.toBeNull()
    })

    test('dragging input to input drags existing link', async ({
      comfyPage,
      comfyMouse
    }) => {
      const clipNode = (
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      )[0]
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      expect(clipNode && samplerNode).toBeTruthy()

      // Step 1: Connect CLIP's only output (index 0) to KSampler's second input (index 1)
      await connectSlots(
        comfyPage.page,
        { nodeId: clipNode.id, index: 0 },
        { nodeId: samplerNode.id, index: 1 },
        () => comfyPage.nextFrame()
      )

      // Verify initial link exists between CLIP -> KSampler input[1]
      await expect
        .poll(() => getInputLinkDetails(comfyPage.page, samplerNode.id, 1))
        .toMatchObject({
          originId: clipNode.id,
          targetId: samplerNode.id,
          targetSlot: 1
        })

      // Step 2: Drag from KSampler's second input to its third input (index 2)
      const input2Center = await getSlotCenter(
        comfyPage.page,
        samplerNode.id,
        1,
        true
      )
      const input3Center = await getSlotCenter(
        comfyPage.page,
        samplerNode.id,
        2,
        true
      )

      await comfyMouse.move(input2Center)
      await comfyMouse.drag(input3Center)
      await comfyMouse.drop()

      // Expect old link removed from input[1]
      await expect
        .poll(() => getInputLinkDetails(comfyPage.page, samplerNode.id, 1))
        .toBeNull()

      // Expect new link exists at input[2] from CLIP
      await expect
        .poll(() => getInputLinkDetails(comfyPage.page, samplerNode.id, 2))
        .toMatchObject({
          originId: clipNode.id,
          targetId: samplerNode.id,
          targetSlot: 2
        })
    })

    test('shift-dragging an output with multiple links should drag all links', async ({
      comfyPage,
      comfyMouse
    }) => {
      const clipNode = (
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      )[0]
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      expect(clipNode && samplerNode).toBeTruthy()

      const clipOutput = await clipNode.getOutput(0)

      // Connect output[0] -> inputs[1] and [2]
      await connectSlots(
        comfyPage.page,
        { nodeId: clipNode.id, index: 0 },
        { nodeId: samplerNode.id, index: 1 },
        () => comfyPage.nextFrame()
      )
      await connectSlots(
        comfyPage.page,
        { nodeId: clipNode.id, index: 0 },
        { nodeId: samplerNode.id, index: 2 },
        () => comfyPage.nextFrame()
      )

      await expect.poll(() => clipOutput.getLinkCount()).toBe(2)

      const outputCenter = await getSlotCenter(
        comfyPage.page,
        clipNode.id,
        0,
        false
      )
      const dragTarget = {
        x: outputCenter.x + 40,
        y: outputCenter.y - 140
      }

      let dropPending = false
      let shiftHeld = false
      try {
        await comfyMouse.move(outputCenter)
        await comfyPage.page.keyboard.down('Shift')
        shiftHeld = true
        await comfyMouse.drag(dragTarget)
        dropPending = true

        await expect(comfyPage.canvas).toHaveScreenshot(
          'vue-node-shift-output-multi-link.png'
        )
      } finally {
        if (dropPending) await comfyMouse.drop().catch(() => {})
        if (shiftHeld) await comfyPage.page.keyboard.up('Shift').catch(() => {})
      }
    })

    test('should snap to node center while dragging and link on drop', async ({
      comfyPage,
      comfyMouse
    }) => {
      const clipNode = (
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      )[0]
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      expect(clipNode && samplerNode).toBeTruthy()

      // Start drag from CLIP output[0]
      const clipOutputCenter = await getSlotCenter(
        comfyPage.page,
        clipNode.id,
        0,
        false
      )

      // Drag to the visual center of the KSampler Vue node (not a slot)
      const samplerVue = comfyPage.vueNodes.getNodeLocator(
        String(samplerNode.id)
      )
      await expect(samplerVue).toBeVisible()
      const samplerCenter = await getCenter(samplerVue)

      await comfyMouse.move(clipOutputCenter)
      await comfyMouse.drag(samplerCenter)

      // During drag, the preview should snap/highlight a compatible input on KSampler
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-snap-to-node.png'
      )

      // Drop to create the link
      await comfyMouse.drop()

      // Validate a link was created to one of KSampler's compatible inputs (1 or 2)
      await expect
        .poll(async () => {
          const link1 = await getInputLinkDetails(
            comfyPage.page,
            samplerNode.id,
            1
          )
          const link2 = await getInputLinkDetails(
            comfyPage.page,
            samplerNode.id,
            2
          )
          return link1 ?? link2
        })
        .toMatchObject({
          originId: clipNode.id,
          targetId: samplerNode.id
        })
    })

    test('should snap to a specific compatible slot when targeting it', async ({
      comfyPage,
      comfyMouse
    }) => {
      const clipNode = (
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      )[0]
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      expect(clipNode && samplerNode).toBeTruthy()

      // Drag from CLIP output[0] to KSampler input[2] (third slot) which is the
      // second compatible input for CLIP
      const clipOutputCenter = await getSlotCenter(
        comfyPage.page,
        clipNode.id,
        0,
        false
      )
      const samplerInput3Center = await getSlotCenter(
        comfyPage.page,
        samplerNode.id,
        2,
        true
      )

      await comfyMouse.move(clipOutputCenter)
      await comfyMouse.drag(samplerInput3Center)

      // Expect the preview to show snapping to the targeted slot
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-snap-to-slot.png'
      )

      // Finish the connection
      await comfyMouse.drop()

      await expect
        .poll(() => getInputLinkDetails(comfyPage.page, samplerNode.id, 2))
        .toMatchObject({
          originId: clipNode.id,
          targetId: samplerNode.id,
          targetSlot: 2
        })
    })

    test('should batch disconnect all links with ctrl+alt+click on slot', async ({
      comfyPage
    }) => {
      const clipNode = (
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      )[0]
      const samplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )[0]
      expect(clipNode && samplerNode).toBeTruthy()

      await connectSlots(
        comfyPage.page,
        { nodeId: clipNode.id, index: 0 },
        { nodeId: samplerNode.id, index: 1 },
        () => comfyPage.nextFrame()
      )
      await connectSlots(
        comfyPage.page,
        { nodeId: clipNode.id, index: 0 },
        { nodeId: samplerNode.id, index: 2 },
        () => comfyPage.nextFrame()
      )

      const clipOutput = await clipNode.getOutput(0)
      await expect.poll(() => clipOutput.getLinkCount()).toBe(2)

      const clipOutputSlot = slotLocator(comfyPage.page, clipNode.id, 0, false)

      await clipOutputSlot.dispatchEvent('pointerdown', {
        button: 0,
        buttons: 1,
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        bubbles: true,
        cancelable: true
      })

      await expect.poll(() => clipOutput.getLinkCount()).toBe(0)
    })

    test.describe('Release actions (Shift-drop)', () => {
      test('Context menu opens and endpoint is pinned on Shift-drop', async ({
        comfyPage,
        comfyMouse
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.LinkRelease.ActionShift',
          'context menu'
        )

        const samplerNode = (
          await comfyPage.nodeOps.getNodeRefsByType('KSampler')
        )[0]
        expect(samplerNode).toBeTruthy()

        const outputCenter = await getSlotCenter(
          comfyPage.page,
          samplerNode.id,
          0,
          false
        )

        const dropPos = { x: outputCenter.x + 90, y: outputCenter.y - 70 }

        await comfyMouse.move(outputCenter)
        await comfyPage.page.keyboard.down('Shift')
        try {
          await comfyMouse.drag(dropPos)
          await comfyMouse.drop()
        } finally {
          await comfyPage.page.keyboard.up('Shift').catch(() => {})
        }

        // Context menu should be visible
        const contextMenu = comfyPage.page.locator('.litecontextmenu')
        await expect(contextMenu).toBeVisible()

        // Pinned endpoint should not change with mouse movement while menu is open
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => {
              const snap =
                window.app?.canvas?.linkConnector?.state?.snapLinksPos
              return Array.isArray(snap) ? [snap[0], snap[1]] : null
            })
          )
          .not.toBeNull()

        const before = await comfyPage.page.evaluate(() => {
          const snap = window.app?.canvas?.linkConnector?.state?.snapLinksPos
          return Array.isArray(snap) ? [snap[0], snap[1]] : null
        })

        // Move mouse elsewhere and verify snap position is unchanged
        await comfyMouse.move({ x: dropPos.x + 160, y: dropPos.y + 100 })
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => {
              const snap =
                window.app?.canvas?.linkConnector?.state?.snapLinksPos
              return Array.isArray(snap) ? [snap[0], snap[1]] : null
            })
          )
          .toEqual(before)
      })

      test('Context menu -> Search pre-filters by link type and connects after selection', async ({
        comfyPage,
        comfyMouse
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.LinkRelease.ActionShift',
          'context menu'
        )
        await comfyPage.settings.setSetting(
          'Comfy.NodeSearchBoxImpl',
          'v1 (legacy)'
        )

        const samplerNode = (
          await comfyPage.nodeOps.getNodeRefsByType('KSampler')
        )[0]
        expect(samplerNode).toBeTruthy()

        const outputCenter = await getSlotCenter(
          comfyPage.page,
          samplerNode.id,
          0,
          false
        )
        const dropPos = { x: outputCenter.x + 200, y: outputCenter.y - 100 }

        await comfyMouse.move(outputCenter)
        await comfyPage.page.keyboard.down('Shift')
        try {
          await comfyMouse.drag(dropPos)
          await comfyMouse.drop()
        } finally {
          await comfyPage.page.keyboard.up('Shift').catch(() => {})
        }

        // Open Search from the context menu
        await comfyPage.contextMenu.clickMenuItem('Search')
        await comfyPage.nextFrame()

        // Search box opens with prefilled type filter based on link type (LATENT)
        await expect(comfyPage.searchBox.input).toBeVisible()
        const chips = comfyPage.searchBox.filterChips
        // Ensure at least one filter chip exists and it matches the link type
        await expect(chips.first()).toBeVisible()
        await expect(chips.first()).toContainText('LATENT')

        // Choose a compatible node and verify it auto-connects
        await comfyPage.searchBox.fillAndSelectFirstNode('VAEDecode')

        // KSampler output should now have an outgoing link
        const samplerOutput = await samplerNode.getOutput(0)
        await expect.poll(() => samplerOutput.getLinkCount()).toBe(1)

        // One of the VAEDecode nodes should have an incoming link on input[0]
        await expect
          .poll(async () => {
            const vaeNodes =
              await comfyPage.nodeOps.getNodeRefsByType('VAEDecode')
            for (const vae of vaeNodes) {
              const details = await getInputLinkDetails(
                comfyPage.page,
                vae.id,
                0
              )
              if (details) return details.originId
            }
            return null
          })
          .toBe(samplerNode.id)
      })

      test('Search box opens on Shift-drop and connects after selection', async ({
        comfyPage,
        comfyMouse
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.LinkRelease.ActionShift',
          'search box'
        )
        await comfyPage.settings.setSetting(
          'Comfy.NodeSearchBoxImpl',
          'v1 (legacy)'
        )

        const samplerNode = (
          await comfyPage.nodeOps.getNodeRefsByType('KSampler')
        )[0]
        expect(samplerNode).toBeTruthy()

        const outputCenter = await getSlotCenter(
          comfyPage.page,
          samplerNode.id,
          0,
          false
        )
        const dropPos = { x: outputCenter.x + 140, y: outputCenter.y - 100 }

        await comfyMouse.move(outputCenter)
        await comfyPage.page.keyboard.down('Shift')
        try {
          await comfyMouse.drag(dropPos)
          await comfyMouse.drop()
        } finally {
          await comfyPage.page.keyboard.up('Shift').catch(() => {})
        }

        // Search box should open directly
        await expect(comfyPage.searchBox.input).toBeVisible()
        await expect(comfyPage.searchBox.filterChips.first()).toContainText(
          'LATENT'
        )

        // Select a compatible node and verify connection
        await comfyPage.searchBox.fillAndSelectFirstNode('VAEDecode')

        const samplerOutput = await samplerNode.getOutput(0)
        await expect.poll(() => samplerOutput.getLinkCount()).toBe(1)

        await expect
          .poll(async () => {
            const vaeNodes =
              await comfyPage.nodeOps.getNodeRefsByType('VAEDecode')
            for (const vae of vaeNodes) {
              const details = await getInputLinkDetails(
                comfyPage.page,
                vae.id,
                0
              )
              if (details) return details.originId
            }
            return null
          })
          .toBe(samplerNode.id)
      })
    })

    test('Dragging from subgraph input connects to correct slot', async ({
      comfyPage,
      comfyMouse
    }) => {
      // Setup workflow with a KSampler node
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.nodeOps.waitForGraphNodes(0)
      await comfyPage.searchBoxV2.addNode('KSampler')
      await comfyPage.nodeOps.waitForGraphNodes(1)

      // Convert the KSampler node to a subgraph
      let ksamplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      )?.[0]
      await comfyPage.vueNodes.selectNode(String(ksamplerNode.id))
      await comfyPage.command.executeCommand('Comfy.Graph.ConvertToSubgraph')

      // Enter the subgraph
      await comfyPage.vueNodes.enterSubgraph()
      await fitToViewInstant(comfyPage)

      // Get the KSampler node inside the subgraph
      ksamplerNode = (
        await comfyPage.nodeOps.getNodeRefsByType('KSampler', true)
      )?.[0]
      const positiveInput = await ksamplerNode.getInput(1)
      const negativeInput = await ksamplerNode.getInput(2)

      const positiveInputPos = await getSlotCenter(
        comfyPage.page,
        ksamplerNode.id,
        1,
        true
      )

      const sourceSlot = await comfyPage.subgraph.getInputSlot()
      const calculatedSourcePos = await sourceSlot.getOpenSlotPosition()

      await comfyMouse.move(calculatedSourcePos)
      await comfyMouse.drag(positiveInputPos)
      await comfyMouse.drop()

      // Verify connection went to the correct slot
      await expect.poll(() => positiveInput.getLinkCount()).toBe(1)
      await expect.poll(() => negativeInput.getLinkCount()).toBe(0)
    })
  }
)

test.describe('Vue Node Widget Link Position', { tag: '@vue-nodes' }, () => {
  test('should keep widget-input link aligned after persisted-workflow reload', async ({
    comfyPage
  }) => {
    test.setTimeout(30000)

    await comfyPage.workflow.loadWorkflow(
      'vueNodes/ksampler-denoise-widget-link'
    )
    await comfyPage.vueNodes.waitForNodes(2)
    await comfyPage.workflow.waitForDraftPersisted()
    await comfyPage.workflow.reloadAndWaitForApp()
    await comfyPage.vueNodes.waitForNodes(2)

    const ksampler = await comfyPage.page.evaluate(() => {
      const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')
      if (!node) return null
      const findIndex = (name: string) =>
        node.inputs.findIndex(
          (input) => input.name === name || input.widget?.name === name
        )
      return {
        id: node.id,
        denoiseIndex: findIndex('denoise'),
        schedulerIndex: findIndex('scheduler')
      }
    })
    if (!ksampler) {
      throw new Error('KSampler should be present in fixture')
    }
    expect(
      ksampler.denoiseIndex,
      'denoise input slot not found'
    ).toBeGreaterThanOrEqual(0)
    expect(
      ksampler.schedulerIndex,
      'scheduler input slot not found'
    ).toBeGreaterThanOrEqual(0)

    const denoiseSlot = slotLocator(
      comfyPage.page,
      ksampler.id,
      ksampler.denoiseIndex,
      true
    )
    const schedulerSlot = slotLocator(
      comfyPage.page,
      ksampler.id,
      ksampler.schedulerIndex,
      true
    )
    await expectVisibleAll(denoiseSlot, schedulerSlot)

    await expect
      .poll(() =>
        getInputLinkDetails(comfyPage.page, ksampler.id, ksampler.denoiseIndex)
      )
      .toMatchObject({
        targetId: ksampler.id,
        targetSlot: ksampler.denoiseIndex
      })

    // If the regression returns, getInputPos stays stale relative to the
    // grown slot DOM and the endpoint drifts toward scheduler. Re-read
    // positions each retry so layout settle doesn't cause flakes.
    await expect(async () => {
      const linkEnd = await comfyPage.page.evaluate(
        ([nodeId, targetSlotIndex]) => {
          const node = window.app!.graph.getNodeById(nodeId)
          if (!node) return null
          const slotPos = node.getInputPos(targetSlotIndex)
          const [cx, cy] = window.app!.canvas.ds.convertOffsetToCanvas([
            slotPos[0],
            slotPos[1]
          ])
          const rect = window.app!.canvas.canvas.getBoundingClientRect()
          return { x: cx + rect.left, y: cy + rect.top }
        },
        [ksampler.id, ksampler.denoiseIndex] as const
      )
      expect(linkEnd, 'link endpoint should resolve').not.toBeNull()

      const denoiseCenter = await getCenter(denoiseSlot)
      const schedulerCenter = await getCenter(schedulerSlot)
      const distToDenoise = Math.hypot(
        linkEnd!.x - denoiseCenter.x,
        linkEnd!.y - denoiseCenter.y
      )
      const rowGap = Math.hypot(
        denoiseCenter.x - schedulerCenter.x,
        denoiseCenter.y - schedulerCenter.y
      )

      // Bound at rowGap / 4 - half the inter-slot midpoint, so any drift
      // toward scheduler fails well before reaching it.
      expect(
        distToDenoise,
        `Link endpoint (${linkEnd!.x.toFixed(1)}, ${linkEnd!.y.toFixed(1)}) is ` +
          `${distToDenoise.toFixed(1)}px from denoise — should be within ` +
          `${(rowGap / 4).toFixed(1)}px (quarter of inter-slot gap ${rowGap.toFixed(1)}px)`
      ).toBeLessThan(rowGap / 4)
    }).toPass({ timeout: 5000 })
  })
})

test(
  'Fast disconnection support',
  { tag: '@vue-nodes' },
  async ({ comfyMouse, comfyPage }) => {
    async function performDisconnect(slot: Locator, isFast: boolean) {
      await comfyMouse.dragElementBy(slot, { x: isFast ? -25 : -80 })

      if (!isFast) {
        await expect(comfyPage.contextMenu.litegraphContextMenu).toBeVisible()
        await comfyMouse.click(100, 100)
      }
      const isConnected = () => comfyPage.vueNodes.isSlotConnected(slot)
      await expect.poll(isConnected).toBe(false)
      await expect(comfyPage.contextMenu.litegraphContextMenu).toBeHidden()
    }

    const ksamplerLocator = comfyPage.vueNodes.getNodeByTitle('KSampler')
    const ksampler = new VueNodeFixture(ksamplerLocator)
    await comfyMouse.dragElementBy(ksamplerLocator, { x: 100 })

    await test.step('Disconnection with normal links', async () => {
      await performDisconnect(ksampler.getSlot('model'), true)
      await performDisconnect(ksampler.getSlot('positive'), false)
    })

    await test.step('Create subgraph', async () => {
      await ksampler.title.click()
      await comfyPage.page.keyboard.press('Control+Shift+e')
      await comfyPage.vueNodes.enterSubgraph()
    })

    await test.step('Disconnection with subgraph IO', async () => {
      await performDisconnect(ksampler.getSlot('negative'), true)
      await performDisconnect(ksampler.getSlot('latent_image'), false)
    })
  }
)
