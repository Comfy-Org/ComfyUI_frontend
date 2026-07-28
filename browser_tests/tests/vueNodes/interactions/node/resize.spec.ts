import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'
import type { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'
import {
  RESIZE_HANDLES,
  hasNorthEdge,
  hasWestEdge
} from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'

async function resizeExpandedNode(
  node: VueNodeFixture,
  nodeRef: NodeReference
) {
  const initialSize = await nodeRef.getSize()
  const box = await node.boundingBox()
  if (!box) throw new Error('Node bounding box not found')

  await node.resizeFromCorner('SE', 73, 47)

  await expect
    .poll(async () => {
      const size = await nodeRef.getSize()
      return size.width > initialSize.width && size.height > initialSize.height
    })
    .toBe(true)

  return nodeRef.getSize()
}

test.describe(
  'Vue Node Resizing',
  { tag: ['@vue-nodes', '@canvas', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
      await comfyPage.canvasOps.resetView()
    })

    test('Resizing', async ({ comfyPage }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const box = (await node.boundingBox())!
      const getX = async () => (await node.boundingBox())?.x ?? -1
      const getY = async () => (await node.boundingBox())?.y ?? -1
      const getRight = async () => {
        const bounds = await node.boundingBox()
        return bounds ? bounds.x + bounds.width : -1
      }
      const getBottom = async () => {
        const bounds = await node.boundingBox()
        return bounds ? bounds.y + bounds.height : -1
      }
      const getWidth = async () => (await node.boundingBox())?.width ?? -1
      const getHeight = async () => (await node.boundingBox())?.height ?? -1

      const cornerCases = RESIZE_HANDLES.map((h) => ({
        corner: h.corner,
        dragX: hasWestEdge(h.corner) ? -50 : 50,
        dragY: hasNorthEdge(h.corner) ? -40 : 40
      }))

      for (const { corner, dragX, dragY } of cornerCases) {
        await test.step(`Grow from ${corner}`, async () => {
          const getAnchorX = hasWestEdge(corner) ? getRight : getX
          const getAnchorY = hasNorthEdge(corner) ? getBottom : getY
          const initialAnchorX = await getAnchorX()
          const initialAnchorY = await getAnchorY()

          await node.resizeFromCorner(corner, dragX, dragY)

          await expect.poll(getAnchorX).toBeCloseTo(initialAnchorX, 0)
          await expect.poll(getAnchorY).toBeCloseTo(initialAnchorY, 0)

          await expect.poll(getWidth).toBeGreaterThan(box.width)
          await expect.poll(getHeight).toBeGreaterThan(box.height)

          if (hasWestEdge(corner)) {
            await expect.poll(getX).toBeLessThan(box.x)
          } else {
            await expect.poll(getX).toBeCloseTo(box.x, 0)
          }

          if (hasNorthEdge(corner)) {
            await expect.poll(getY).toBeLessThan(box.y)
          } else {
            await expect.poll(getY).toBeCloseTo(box.y, 0)
          }

          await comfyPage.keyboard.undo()
          await expect(node.root).toHaveBounds(box)
        })
      }
    })

    test.describe('minimum size enforcement', () => {
      test('SW resize clamps width, keeping right edge fixed', async ({
        comfyPage
      }) => {
        const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
        const box = (await node.boundingBox())!
        const getRight = async () => {
          const bounds = await node.boundingBox()
          return bounds ? bounds.x + bounds.width : -1
        }
        const getWidth = async () => (await node.boundingBox())?.width ?? -1
        const scale = await comfyPage.canvasOps.getScale()

        const initialRight = await getRight()

        await node.resizeFromCorner('SW', box.width + 100, 0)

        await expect.poll(getRight).toBeCloseTo(initialRight, 0)
        await expect
          .poll(getWidth)
          .toBeGreaterThanOrEqual(MIN_NODE_WIDTH * scale)
      })

      test('NE resize clamps height at its lower bound', async ({
        comfyPage
      }) => {
        const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
        const getBottom = async () => {
          const bounds = await node.boundingBox()
          return bounds ? bounds.y + bounds.height : -1
        }
        const getHeight = async () => (await node.boundingBox())?.height ?? -1

        // Default nodes render at content-minimum height; grow from SE so NE
        // has room to shrink back down to the clamp.
        await node.resizeFromCorner('SE', 0, 200)

        const expandedBox = await node.boundingBox()
        if (!expandedBox)
          throw new Error('Node bounding box not found after SE grow')
        const bottomEdge = expandedBox.y + expandedBox.height

        // Overdrag once to hit the clamp, then again to prove further dragging
        // does not shrink past the minimum (idempotent clamp).
        await node.resizeFromCorner('NE', 0, expandedBox.height + 100)
        const clampedHeight = await getHeight()
        if (clampedHeight === -1)
          throw new Error('Node bounding box not found after NE clamp')
        expect(clampedHeight).toBeLessThan(expandedBox.height)

        await node.resizeFromCorner('NE', 0, 200)

        await expect.poll(getHeight).toBeCloseTo(clampedHeight, 0)
        await expect.poll(getBottom).toBeCloseTo(bottomEdge, 0)
      })
    })

    test('preserves expanded size through collapse and expansion', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const nodeId = await node.root.getAttribute('data-node-id')
      if (!nodeId) throw new Error('Node ID not found')
      const nodeRef = await comfyPage.nodeOps.getNodeRefById(nodeId)
      const expandedSize = await resizeExpandedNode(node, nodeRef)

      await node.collapseButton.dispatchEvent('click')
      await expect(node.root).toHaveAttribute('data-collapsed', 'true')
      await expect.poll(() => nodeRef.getSize()).toEqual(expandedSize)

      await node.collapseButton.dispatchEvent('click')
      await expect(node.root).not.toHaveAttribute('data-collapsed', 'true')
      await expect.poll(() => nodeRef.getSize()).toEqual(expandedSize)
    })

    test('preserves expanded size when a collapsed workflow is reloaded', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const nodeId = await node.root.getAttribute('data-node-id')
      if (!nodeId) throw new Error('Node ID not found')
      const nodeRef = await comfyPage.nodeOps.getNodeRefById(nodeId)
      const expandedSize = await resizeExpandedNode(node, nodeRef)

      await node.collapseButton.dispatchEvent('click')
      await expect(node.root).toHaveAttribute('data-collapsed', 'true')
      await expect.poll(() => nodeRef.getSize()).toEqual(expandedSize)

      const savedWorkflow = await comfyPage.workflow.getExportedWorkflow()
      await comfyPage.workflow.loadGraphData(savedWorkflow)
      await comfyPage.vueNodes.waitForNodes()

      const reloadedNode =
        await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      await expect(reloadedNode.root).toHaveAttribute('data-collapsed', 'true')

      await reloadedNode.collapseButton.dispatchEvent('click')
      await expect(reloadedNode.root).not.toHaveAttribute(
        'data-collapsed',
        'true'
      )
      await expect.poll(() => nodeRef.getSize()).toEqual(expandedSize)
    })
  }
)
