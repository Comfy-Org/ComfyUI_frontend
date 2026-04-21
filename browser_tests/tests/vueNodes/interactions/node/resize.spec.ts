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
  const node = await comfyPage.vueNodes.getFixtureByTitle(title)
  await node.header.click()
  const box = await node.boundingBox()
  if (!box) throw new Error(`Node "${title}" bounding box not found`)
  return { node, box }
}

test.describe('Vue Node Resizing', { tag: '@vue-nodes' }, () => {
  // Minimap overlays the canvas corners and intercepts pointer events that
  // happen to land in its hit area during resize drags, so disable it for the
  // whole suite.
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
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

  // Drag a tested center-positioned node from every non-SE corner so the
  // non-default switch arms in useNodeResize run under real DOM events.
  const nonSeCornerCases = RESIZE_HANDLES.filter((h) => h.corner !== 'SE').map(
    (h) => ({
      corner: h.corner,
      dragX: hasWestEdge(h.corner) ? -50 : 50,
      dragY: hasNorthEdge(h.corner) ? -40 : 40
    })
  )

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

        const anchorX = hasWestEdge(corner) ? box.x + box.width : box.x
        const anchorY = hasNorthEdge(corner) ? box.y + box.height : box.y

        await node.resizeFromCorner(corner, dragX, dragY)

        await expect
          .poll(async () => {
            const b = await node.boundingBox()
            return b ? (hasWestEdge(corner) ? b.x + b.width : b.x) : null
          })
          .toBeCloseTo(anchorX, 0)
        await expect
          .poll(async () => {
            const b = await node.boundingBox()
            return b ? (hasNorthEdge(corner) ? b.y + b.height : b.y) : null
          })
          .toBeCloseTo(anchorY, 0)
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

      await expect
        .poll(async () => {
          const b = await node.boundingBox()
          return b ? b.x + b.width : null
        })
        .toBeCloseTo(rightEdge, 0)
      await expect
        .poll(async () => (await node.boundingBox())?.width)
        .toBeGreaterThanOrEqual(MIN_NODE_WIDTH)
    })

    test('NE resize clamps height, keeping bottom edge fixed', async ({
      comfyPage
    }) => {
      const { node } = await setupResizableNode(comfyPage, 'KSampler')

      // Default nodes render at content-minimum height, so grow south via SE
      // first to give NE room to shrink back to the clamp.
      await node.resizeFromCorner('SE', 0, 200)

      const box = await node.boundingBox()
      if (!box) throw new Error('Node bounding box not found after SE grow')
      const bottomEdge = box.y + box.height

      await node.resizeFromCorner('NE', 0, box.height + 100)

      await expect
        .poll(async () => {
          const b = await node.boundingBox()
          return b ? b.y + b.height : null
        })
        .toBeCloseTo(bottomEdge, 0)
      await expect
        .poll(async () => (await node.boundingBox())?.height)
        .toBeLessThan(box.height)
    })
  })
})
