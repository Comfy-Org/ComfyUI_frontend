import type { Locator } from '@playwright/test'

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
  await node.header.click()
  const box = await node.boundingBox()
  if (!box) throw new Error(`Node "${title}" bounding box not found`)
  return { node, box }
}

const leftEdgeOf = (locator: Locator) => async () =>
  (await locator.boundingBox())?.x ?? null
const topEdgeOf = (locator: Locator) => async () =>
  (await locator.boundingBox())?.y ?? null
const rightEdgeOf = (locator: Locator) => async () => {
  const b = await locator.boundingBox()
  return b ? b.x + b.width : null
}
const bottomEdgeOf = (locator: Locator) => async () => {
  const b = await locator.boundingBox()
  return b ? b.y + b.height : null
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
      const node = await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
      const initialBox = await node.boundingBox()
      if (!initialBox) throw new Error('Node bounding box not found')

      await node.header.click()

      const selectedBox = await node.boundingBox()
      if (!selectedBox)
        throw new Error('Node bounding box not found after select')

      await expect
        .poll(async () => (await node.boundingBox())?.x)
        .toBeCloseTo(initialBox.x, 1)
      await expect
        .poll(async () => (await node.boundingBox())?.y)
        .toBeCloseTo(initialBox.y, 1)

      const resizeStartX = selectedBox.x + selectedBox.width - 5
      const resizeStartY = selectedBox.y + selectedBox.height - 5

      await comfyPage.page.mouse.move(resizeStartX, resizeStartY)
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(resizeStartX + 50, resizeStartY + 30)
      await comfyPage.page.mouse.up()

      await expect
        .poll(async () => (await node.boundingBox())?.x)
        .toBeCloseTo(initialBox.x, 1)
      await expect
        .poll(async () => (await node.boundingBox())?.y)
        .toBeCloseTo(initialBox.y, 1)

      await expect
        .poll(async () => (await node.boundingBox())?.width)
        .toBeGreaterThan(initialBox.width)
      await expect
        .poll(async () => (await node.boundingBox())?.height)
        .toBeGreaterThan(initialBox.height)
    })

    // Exercise every non-SE corner. SE is covered by the drift test above.
    const nonSeCornerCases = RESIZE_HANDLES.filter(
      (h) => h.corner !== 'SE'
    ).map((h) => ({
      corner: h.corner,
      dragX: hasWestEdge(h.corner) ? -50 : 50,
      dragY: hasNorthEdge(h.corner) ? -40 : 40
    }))

    test.describe('corner resize directions', () => {
      nonSeCornerCases.forEach(({ corner, dragX, dragY }) => {
        test(`${corner}: size increases and correct edges shift`, async ({
          comfyPage
        }) => {
          const { node, box } = await setupResizableNode(comfyPage, 'KSampler')

          await node.resizeFromCorner(corner, dragX, dragY)

          await expect
            .poll(async () => (await node.boundingBox())?.width)
            .toBeGreaterThan(box.width)
          await expect
            .poll(async () => (await node.boundingBox())?.height)
            .toBeGreaterThan(box.height)

          if (hasWestEdge(corner)) {
            await expect
              .poll(async () => (await node.boundingBox())?.x)
              .toBeLessThan(box.x)
          } else {
            await expect
              .poll(async () => (await node.boundingBox())?.x)
              .toBeCloseTo(box.x, 0)
          }

          if (hasNorthEdge(corner)) {
            await expect
              .poll(async () => (await node.boundingBox())?.y)
              .toBeLessThan(box.y)
          } else {
            await expect
              .poll(async () => (await node.boundingBox())?.y)
              .toBeCloseTo(box.y, 0)
          }
        })
      })
    })

    test.describe('opposite edge anchoring', () => {
      nonSeCornerCases.forEach(({ corner, dragX, dragY }) => {
        test(`${corner} resize keeps opposite corner fixed`, async ({
          comfyPage
        }) => {
          const { node, box } = await setupResizableNode(comfyPage, 'KSampler')

          const pollAnchorX = hasWestEdge(corner)
            ? rightEdgeOf(node.root)
            : leftEdgeOf(node.root)
          const pollAnchorY = hasNorthEdge(corner)
            ? bottomEdgeOf(node.root)
            : topEdgeOf(node.root)

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

        await expect.poll(rightEdgeOf(node.root)).toBeCloseTo(rightEdge, 0)
        await expect
          .poll(async () => (await node.boundingBox())?.width)
          .toBeGreaterThanOrEqual(MIN_NODE_WIDTH)
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

        await expect
          .poll(async () => (await node.boundingBox())?.height)
          .toBeCloseTo(clampedHeight, 0)
        await expect.poll(bottomEdgeOf(node.root)).toBeCloseTo(bottomEdge, 0)
      })
    })
  }
)
