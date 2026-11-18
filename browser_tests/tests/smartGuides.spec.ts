import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position } from '@e2e/fixtures/types'

const ANCHOR_LEFT = 55
const NEAR_MISS = { x: -5, y: 60 }
const ROW_TITLES = ['A', 'B', 'C']

interface NodeRect {
  left: number
  top: number
  right: number
  bottom: number
}

async function nodeRects(comfyPage: ComfyPage, titles: string[]) {
  return comfyPage.page.evaluate(
    (wanted) =>
      wanted.map((title) => {
        const node = window.app!.canvas.graph!.nodes.find(
          (candidate) => candidate.title === title
        )
        if (!node) throw new Error(`Node ${title} not found`)
        const [x, y] = node.pos
        const [width, height] = node.size
        return { left: x, top: y, right: x + width, bottom: y + height }
      }),
    titles
  )
}

async function nodeLeft(comfyPage: ComfyPage, title: string) {
  const [rect] = await nodeRects(comfyPage, [title])
  return rect.left
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

async function openAlign(comfyPage: ComfyPage) {
  await comfyPage.keyboard.selectAll()
  await comfyPage.page.getByRole('button', { name: 'Align' }).click()
}

test.describe('Smart guides', { tag: ['@vue-nodes', '@canvas'] }, () => {
  test.describe('Dragging a node near another node’s left edge', () => {
    const cases = [
      { name: 'snaps onto the edge', enabled: true, shift: false },
      { name: 'stays put while Shift is held', enabled: true, shift: true },
      { name: 'stays put when disabled', enabled: false, shift: false }
    ]

    for (const { name, enabled, shift } of cases) {
      test.describe(name, () => {
        test.use({
          initialSettings: { 'Comfy.Canvas.SmartGuides.Enabled': enabled }
        })

        test('lands on the expected left edge', async ({
          comfyPage,
          comfyMouse
        }) => {
          await comfyPage.workflow.loadWorkflow('smartGuides/two_notes')
          const dragged = await comfyPage.vueNodes.getFixtureByTitle('Dragged')
          const { keyboard } = comfyPage.page
          if (shift) await keyboard.down('Shift')
          try {
            await comfyMouse.dragElementBy(dragged.header, NEAR_MISS)
          } finally {
            if (shift) await keyboard.up('Shift')
          }

          const snaps = enabled && !shift
          await expect
            .poll(() => nodeLeft(comfyPage, 'Dragged'))
            .toBeCloseTo(snaps ? ANCHOR_LEFT : ANCHOR_LEFT + NEAR_MISS.x, 0)
        })
      })
    }
  })

  test('dropping a node just off level makes its wire horizontal', async ({
    comfyPage,
    comfyMouse
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'smartGuides/checkpoint_to_vae_decode'
    )
    const slotHeights = () =>
      comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const checkpoint = graph.nodes.find(
          (n) => n.title === 'Load Checkpoint'
        )!
        const decode = graph.nodes.find((n) => n.title === 'VAE Decode')!
        return {
          output: checkpoint.getOutputPos(2)[1],
          input: decode.getInputPos(1)[1]
        }
      })
    const { output, input } = await slotHeights()
    const decode = await comfyPage.vueNodes.getFixtureByTitle('VAE Decode')

    await comfyMouse.dragElementBy(decode.header, {
      x: 0,
      y: output - input + 5
    })

    await expect
      .poll(async () => {
        const heights = await slotHeights()
        return heights.input - heights.output
      })
      .toBeCloseTo(0, 0)
  })

  test('resizing a group from its top-left corner snaps to a node edge and keeps the opposite corner', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('smartGuides/group_and_note')
    const groupBounds = () =>
      comfyPage.page.evaluate(() => [
        ...window.app!.canvas.graph!.groups[0].boundingRect
      ])
    const [x, y, width, height] = await groupBounds()
    const nearAnchorLeft = 50 - 3

    await dragWithSteps(
      comfyPage,
      await canvasToClient(comfyPage, [x + 2, y + 2]),
      await canvasToClient(comfyPage, [nearAnchorLeft + 2, y + 2])
    )

    await expect.poll(groupBounds).toEqual([50, y, x + width - 50, height])
  })

  test.describe('Align popover', () => {
    test.use({
      initialSettings: { 'Comfy.Canvas.SelectionToolbox': true }
    })

    const alignCases: {
      action: string
      edge: keyof NodeRect
      target: (values: number[]) => number
    }[] = [
      {
        action: 'Align left edges',
        edge: 'left',
        target: (v) => Math.min(...v)
      },
      {
        action: 'Align right edges',
        edge: 'right',
        target: (v) => Math.max(...v)
      },
      { action: 'Align top edges', edge: 'top', target: (v) => Math.min(...v) },
      {
        action: 'Align bottom edges',
        edge: 'bottom',
        target: (v) => Math.max(...v)
      }
    ]

    for (const { action, edge, target } of alignCases) {
      test(`${action} lines every node up on the outermost ${edge} edge`, async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
        const before = await nodeRects(comfyPage, ROW_TITLES)
        const expected = target(before.map((rect) => rect[edge]))

        await openAlign(comfyPage)
        await comfyPage.page.getByRole('button', { name: action }).click()

        await expect
          .poll(async () =>
            (await nodeRects(comfyPage, ROW_TITLES)).map((rect) =>
              Math.round(rect[edge])
            )
          )
          .toEqual(ROW_TITLES.map(() => Math.round(expected)))
      })
    }

    test('undo after aligning restores the original layout', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
      const before = await nodeRects(comfyPage, ROW_TITLES)

      await openAlign(comfyPage)
      await comfyPage.page
        .getByRole('button', { name: 'Align top edges' })
        .click()
      await expect
        .poll(() => nodeRects(comfyPage, ROW_TITLES))
        .not.toEqual(before)

      await comfyPage.keyboard.undo()
      await expect.poll(() => nodeRects(comfyPage, ROW_TITLES)).toEqual(before)
    })

    test('distributing, then dragging a gap handle changes every gap and undoes in one step', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
      await openAlign(comfyPage)
      await comfyPage.page
        .getByRole('button', { name: 'Distribute horizontally' })
        .click()

      const gaps = comfyPage.page.getByRole('separator', {
        name: 'Gap between distributed nodes'
      })
      const gapValues = () =>
        gaps.evaluateAll((handles) =>
          handles.map((handle) => Number(handle.getAttribute('aria-valuenow')))
        )
      const lefts = async () =>
        (await nodeRects(comfyPage, ROW_TITLES)).map((rect) => rect.left)
      await expect(gaps).toHaveCount(2)
      const [evenGap] = await gapValues()
      await expect.poll(gapValues).toEqual([evenGap, evenGap])
      const distributedLefts = await lefts()

      const lastHandle = await gaps.last().boundingBox()
      if (!lastHandle) throw new Error('Gap handle has no layout')
      const grip = {
        x: lastHandle.x + lastHandle.width / 2,
        y: lastHandle.y + lastHandle.height / 2
      }
      await dragWithSteps(comfyPage, grip, { x: grip.x + 30, y: grip.y })
      await expect.poll(gapValues).toEqual([evenGap + 20, evenGap + 20])

      await comfyPage.keyboard.undo()
      await expect.poll(lefts).toEqual(distributedLefts)
    })
  })
})
