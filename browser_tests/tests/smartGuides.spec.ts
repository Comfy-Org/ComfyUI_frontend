import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position } from '@e2e/fixtures/types'

const ANCHOR_LEFT = 55
const NEAR_MISS = { x: -5, y: 60 }

async function nodeLeft(comfyPage: ComfyPage, title: string) {
  const [node] = await comfyPage.nodeOps.getNodeRefsByTitle(title)
  const [x] = await node.getProperty<[number, number]>('pos')
  return x
}

async function canvasToClient(comfyPage: ComfyPage, [x, y]: number[]) {
  const [clientX, clientY] = await comfyPage.page.evaluate(
    (pos) => window.app!.canvasPosToClientPos([pos[0], pos[1]]),
    [x, y]
  )
  return { x: clientX, y: clientY }
}

async function dragWithSteps(
  comfyPage: ComfyPage,
  from: Position,
  to: Position
) {
  await comfyPage.page.mouse.move(from.x, from.y)
  await comfyPage.page.mouse.down()
  await comfyPage.page.mouse.move(to.x, to.y, { steps: 20 })
  await comfyPage.page.mouse.up()
  await comfyPage.nextFrame()
}

const EDGE_SNAP_CASES = [
  { name: 'snaps onto the edge', enabled: true, modifiers: [], snaps: true },
  {
    name: 'stays put while Shift is held',
    enabled: true,
    modifiers: ['Shift' as const],
    snaps: false
  },
  {
    name: 'stays put with smart guides disabled',
    enabled: false,
    modifiers: [],
    snaps: false
  }
]

for (const { name, enabled, modifiers, snaps } of EDGE_SNAP_CASES) {
  const expectedLeft = snaps ? ANCHOR_LEFT : ANCHOR_LEFT + NEAR_MISS.x

  test.describe(
    `Dragging a node near another node’s left edge ${name}`,
    { tag: ['@canvas', '@node'] },
    () => {
      test.use({
        initialSettings: { 'Comfy.Canvas.SmartGuides.Enabled': enabled }
      })

      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('smartGuides/two_notes')
      })

      test('classic renderer', async ({ comfyPage }) => {
        const [dragged] = await comfyPage.nodeOps.getNodeRefsByTitle('Dragged')
        await dragged.dragBy(NEAR_MISS, { modifiers })

        await expect
          .poll(() => nodeLeft(comfyPage, 'Dragged'))
          .toBeCloseTo(expectedLeft, 0)
      })

      test(
        'Vue nodes',
        { tag: '@vue-nodes' },
        async ({ comfyPage, comfyMouse }) => {
          const dragged = await comfyPage.vueNodes.getFixtureByTitle('Dragged')
          const keyboard = comfyPage.page.keyboard
          for (const key of modifiers) await keyboard.down(key)
          try {
            await comfyMouse.dragElementBy(dragged.header, NEAR_MISS)
          } finally {
            for (const key of modifiers) await keyboard.up(key)
          }

          await expect
            .poll(() => nodeLeft(comfyPage, 'Dragged'))
            .toBeCloseTo(expectedLeft, 0)
        }
      )
    }
  )
}

test.describe('Straightening a wire', { tag: ['@canvas', '@node'] }, () => {
  test('dropping a node just off level makes its wire horizontal', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'smartGuides/checkpoint_to_vae_decode'
    )
    const [checkpoint] =
      await comfyPage.nodeOps.getNodeRefsByTitle('Load Checkpoint')
    const [decode] = await comfyPage.nodeOps.getNodeRefsByTitle('VAE Decode')
    const vaeOutput = await checkpoint.getOutput(2)
    const vaeInput = await decode.getInput(1)
    const almostLevel =
      (await vaeOutput.getPosition()).y - (await vaeInput.getPosition()).y + 5

    await decode.dragBy({ x: 0, y: almostLevel })

    await expect
      .poll(
        async () =>
          (await vaeInput.getPosition()).y - (await vaeOutput.getPosition()).y
      )
      .toBeCloseTo(0, 0)
  })
})

test.describe(
  'Resizing a group from its top-left corner',
  {
    tag: ['@canvas']
  },
  () => {
    const groupBounds = (comfyPage: ComfyPage) =>
      comfyPage.page.evaluate(() => [
        ...window.app!.canvas.graph!.groups[0].boundingRect
      ])

    test('snaps the dragged edge to a node and keeps the opposite corner', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('smartGuides/group_and_note')
      const [x, y, width, height] = await groupBounds(comfyPage)
      const nearAnchorLeft = 50 - 3

      await dragWithSteps(
        comfyPage,
        await canvasToClient(comfyPage, [x + 2, y + 2]),
        await canvasToClient(comfyPage, [nearAnchorLeft + 2, y + 2])
      )

      await expect
        .poll(() => groupBounds(comfyPage))
        .toEqual([50, y, x + width - 50, height])
    })
  }
)

test.describe(
  'Distributing nodes and dragging a gap handle',
  { tag: ['@canvas', '@node'] },
  () => {
    test.use({
      initialSettings: { 'Comfy.Canvas.SelectionToolbox': true }
    })

    test('every gap follows the handle, and undo restores the distributed layout', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
      await comfyPage.keyboard.selectAll()
      const { page } = comfyPage
      await page.getByRole('button', { name: 'Align' }).click()
      await page
        .getByRole('button', { name: 'Distribute horizontally' })
        .click()

      const gaps = page.getByRole('separator', {
        name: 'Gap between distributed nodes'
      })
      const gapValues = () =>
        gaps.evaluateAll((handles) =>
          handles.map((handle) => Number(handle.getAttribute('aria-valuenow')))
        )
      const nodeLefts = () =>
        Promise.all(['A', 'B', 'C'].map((title) => nodeLeft(comfyPage, title)))
      await expect(gaps).toHaveCount(2)
      const [evenGap] = await gapValues()
      await expect.poll(gapValues).toEqual([evenGap, evenGap])
      const distributedLefts = await nodeLefts()

      const lastHandle = await gaps.last().boundingBox()
      if (!lastHandle) throw new Error('Gap handle has no layout')
      const grip = {
        x: lastHandle.x + lastHandle.width / 2,
        y: lastHandle.y + lastHandle.height / 2
      }
      await dragWithSteps(comfyPage, grip, { x: grip.x + 30, y: grip.y })
      await expect.poll(gapValues).toEqual([evenGap + 20, evenGap + 20])

      await comfyPage.keyboard.undo()
      await expect.poll(nodeLefts).toEqual(distributedLefts)
    })
  }
)
