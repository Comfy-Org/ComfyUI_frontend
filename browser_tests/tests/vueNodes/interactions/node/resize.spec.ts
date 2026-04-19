import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { RESIZE_HANDLES } from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'

test.describe('Vue Node Resizing', { tag: '@vue-nodes' }, () => {
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

  // Derive test cases from production RESIZE_HANDLES config.
  // W in corner → X moves (left edge shifts); N → Y moves (top edge shifts).
  const nonSeCornerCases = RESIZE_HANDLES.filter((h) => h.corner !== 'SE').map(
    (h) => ({
      corner: h.corner,
      dragX: h.corner.includes('W') ? -50 : 50,
      dragY: h.corner.includes('N') ? -40 : 40,
      xMoves: h.corner.includes('W'),
      yMoves: h.corner.includes('N')
    })
  )

  test.describe('corner resize directions', () => {
    nonSeCornerCases.forEach(({ corner, dragX, dragY, xMoves, yMoves }) => {
      test(`${corner}: size increases and correct edges shift`, async ({
        comfyPage
      }) => {
        const node =
          await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
        await node.header.click()
        const box = await node.boundingBox()
        if (!box) throw new Error('Node bounding box not found')

        await node.resizeFromCorner(corner, dragX, dragY)

        await expect
          .poll(async () => (await node.boundingBox())?.width)
          .toBeGreaterThan(box.width)
        await expect
          .poll(async () => (await node.boundingBox())?.height)
          .toBeGreaterThan(box.height)

        if (xMoves) {
          await expect
            .poll(async () => (await node.boundingBox())?.x)
            .toBeLessThan(box.x)
        } else {
          await expect
            .poll(async () => (await node.boundingBox())?.x)
            .toBeCloseTo(box.x, 0)
        }

        if (yMoves) {
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
    nonSeCornerCases.forEach(({ corner, dragX, dragY, xMoves, yMoves }) => {
      test(`${corner} resize keeps opposite corner fixed`, async ({
        comfyPage
      }) => {
        const node =
          await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
        await node.header.click()
        const box = await node.boundingBox()
        if (!box) throw new Error('Node bounding box not found')

        const anchorX = xMoves ? box.x + box.width : box.x
        const anchorY = yMoves ? box.y + box.height : box.y

        await node.resizeFromCorner(corner, dragX, dragY)

        await expect
          .poll(async () => {
            const b = await node.boundingBox()
            return b ? (xMoves ? b.x + b.width : b.x) : null
          })
          .toBeCloseTo(anchorX, 0)
        await expect
          .poll(async () => {
            const b = await node.boundingBox()
            return b ? (yMoves ? b.y + b.height : b.y) : null
          })
          .toBeCloseTo(anchorY, 0)
      })
    })
  })

  test.describe('minimum size enforcement', () => {
    test('SW resize clamps width, keeping right edge fixed', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
      await node.header.click()
      const box = await node.boundingBox()
      if (!box) throw new Error('Node bounding box not found')
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
        .toBeGreaterThan(0)
    })

    test('NE resize clamps height, keeping bottom edge fixed', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
      await node.header.click()
      const box = await node.boundingBox()
      if (!box) throw new Error('Node bounding box not found')
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
        .toBeGreaterThan(0)
    })
  })
})
