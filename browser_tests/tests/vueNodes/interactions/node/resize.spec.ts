import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'
import {
  RESIZE_HANDLES,
  hasNorthEdge,
  hasWestEdge
} from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'

async function setupResizableNode(comfyPage: ComfyPage, title: string) {
  await expect(comfyPage.vueNodes.getNodeByTitle(title)).toHaveCount(1)
  const node = await comfyPage.vueNodes.getFixtureByTitle(title)
  const box = await node.selectAndGetBox()
  return { node, box }
}

test.describe(
  'Vue Node Resizing',
  { tag: ['@vue-nodes', '@canvas', '@node'] },
  () => {
    let originalMinimapVisible: boolean | undefined

    // Minimap overlays the canvas and intercepts pointer events that land in
    // its hit area during resize drags, so disable it for this suite. Capture
    // and restore the prior value to avoid leaking the override to other specs
    // that run on the same user-data-dir.
    test.beforeEach(async ({ comfyPage }) => {
      originalMinimapVisible = await comfyPage.settings.getSetting<boolean>(
        'Comfy.Minimap.Visible'
      )
      await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
      await comfyPage.canvasOps.resetView()
    })

    test.afterEach(async ({ comfyPage }) => {
      if (originalMinimapVisible !== undefined) {
        await comfyPage.settings.setSetting(
          'Comfy.Minimap.Visible',
          originalMinimapVisible
        )
      }
    })

    test('should resize node without position drift after selecting', async ({
      comfyPage
    }) => {
      const { node, box: initialBox } = await setupResizableNode(
        comfyPage,
        'Load Checkpoint'
      )

      await node.expectAnchoredAt(initialBox)

      await node.resizeFromCorner('SE', 50, 30)

      await node.expectAnchoredAt(initialBox)

      await expect.poll(node.pollWidth).toBeGreaterThan(initialBox.width)
      await expect.poll(node.pollHeight).toBeGreaterThan(initialBox.height)
    })

    const cornerCases = RESIZE_HANDLES.map((h) => ({
      corner: h.corner,
      dragX: hasWestEdge(h.corner) ? -50 : 50,
      dragY: hasNorthEdge(h.corner) ? -40 : 40
    }))

    test.describe('corner resize directions', () => {
      cornerCases.forEach(({ corner, dragX, dragY }) => {
        test(`${corner}: size increases and correct edges shift`, async ({
          comfyPage
        }) => {
          const { node, box } = await setupResizableNode(comfyPage, 'KSampler')

          await node.resizeFromCorner(corner, dragX, dragY)

          await expect.poll(node.pollWidth).toBeGreaterThan(box.width)
          await expect.poll(node.pollHeight).toBeGreaterThan(box.height)

          if (hasWestEdge(corner)) {
            await expect.poll(node.pollLeftEdge).toBeLessThan(box.x)
          } else {
            await expect.poll(node.pollLeftEdge).toBeCloseTo(box.x, 0)
          }

          if (hasNorthEdge(corner)) {
            await expect.poll(node.pollTopEdge).toBeLessThan(box.y)
          } else {
            await expect.poll(node.pollTopEdge).toBeCloseTo(box.y, 0)
          }
        })
      })
    })

    test.describe('opposite edge anchoring', () => {
      cornerCases.forEach(({ corner, dragX, dragY }) => {
        test(`${corner} resize keeps opposite corner fixed`, async ({
          comfyPage
        }) => {
          const { node, box } = await setupResizableNode(comfyPage, 'KSampler')

          const pollAnchorX = hasWestEdge(corner)
            ? node.pollRightEdge
            : node.pollLeftEdge
          const pollAnchorY = hasNorthEdge(corner)
            ? node.pollBottomEdge
            : node.pollTopEdge

          const anchorX = hasWestEdge(corner) ? box.x + box.width : box.x
          const anchorY = hasNorthEdge(corner) ? box.y + box.height : box.y

          await node.resizeFromCorner(corner, dragX, dragY)

          await expect.poll(pollAnchorX).toBeCloseTo(anchorX, 0)
          await expect.poll(pollAnchorY).toBeCloseTo(anchorY, 0)
        })
      })
    })

    test.describe('minimum size enforcement', () => {
      test('SW resize clamps width, keeping right edge fixed', async ({
        comfyPage
      }) => {
        const { node, box } = await setupResizableNode(comfyPage, 'KSampler')
        const rightEdge = box.x + box.width

        await node.resizeFromCorner('SW', box.width + 100, 0)

        await expect.poll(node.pollRightEdge).toBeCloseTo(rightEdge, 0)
        await expect.poll(node.pollWidth).toBeGreaterThanOrEqual(MIN_NODE_WIDTH)
      })

      test('NE resize clamps height at its lower bound', async ({
        comfyPage
      }) => {
        const { node } = await setupResizableNode(comfyPage, 'KSampler')

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
        const clampedHeight = (await node.boundingBox())?.height
        if (clampedHeight === undefined)
          throw new Error('Node bounding box not found after NE clamp')
        expect(clampedHeight).toBeLessThan(expandedBox.height)

        await node.resizeFromCorner('NE', 0, 200)

        await expect.poll(node.pollHeight).toBeCloseTo(clampedHeight, 0)
        await expect.poll(node.pollBottomEdge).toBeCloseTo(bottomEdge, 0)
      })
    })
  }
)
