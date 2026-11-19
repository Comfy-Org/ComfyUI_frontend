import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { Locator } from '@playwright/test'

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
        const [x, y, width, height] = node.boundingRect
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

async function openArrange(comfyPage: ComfyPage) {
  await comfyPage.keyboard.selectAll()
  await comfyPage.page.getByRole('button', { name: 'Arrange' }).click()
}

async function distributeRow(comfyPage: ComfyPage) {
  await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
  await openArrange(comfyPage)
  await comfyPage.page
    .getByRole('button', { name: 'Distribute horizontally' })
    .click()
  const gaps = comfyPage.page.getByRole('separator', {
    name: 'Gap between distributed nodes'
  })
  await expect(gaps).toHaveCount(2)
  return gaps
}

function gapValues(gaps: Locator) {
  return gaps.evaluateAll((handles) =>
    handles.map((handle) => Number(handle.getAttribute('aria-valuenow')))
  )
}

test.describe('Smart guides', { tag: ['@vue-nodes', '@canvas'] }, () => {
  test.describe('Dragging a node snaps it into place', () => {
    test.describe('near another node’s left edge', () => {
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
            const dragged =
              await comfyPage.vueNodes.getFixtureByTitle('Dragged')
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

    test.describe('just past the gap two neighbours already have', () => {
      const cases = [
        { name: 'repeats the gap', spacing: true, miss: 0 },
        { name: 'stays put when spacing snap is off', spacing: false, miss: 5 }
      ]

      for (const { name, spacing, miss } of cases) {
        test.describe(name, () => {
          test.use({
            initialSettings: {
              'Comfy.Canvas.SmartGuides.SnapToSpacing': spacing
            }
          })

          test('lands the expected distance after the second neighbour', async ({
            comfyPage,
            comfyMouse
          }) => {
            await comfyPage.workflow.loadWorkflow('smartGuides/spacing_row')
            const [first, second, dragged] = await nodeRects(comfyPage, [
              'A',
              'B',
              'Dragged'
            ])
            const repeatedGapLeft = second.right + (second.left - first.right)
            const node = await comfyPage.vueNodes.getFixtureByTitle('Dragged')

            await comfyMouse.dragElementBy(node.header, {
              x: repeatedGapLeft + 5 - dragged.left,
              y: second.top + 20 - dragged.top
            })

            await expect
              .poll(() => nodeLeft(comfyPage, 'Dragged'))
              .toBeCloseTo(repeatedGapLeft + miss, 0)
          })
        })
      }
    })
  })

  test.describe('Resizing snaps the dragged edges', () => {
    test('resizing a node from its corner snaps its right edge to a neighbour', async ({
      comfyPage,
      comfyMouse
    }) => {
      await comfyPage.workflow.loadWorkflow('smartGuides/two_notes')
      const [anchor, dragged] = await nodeRects(comfyPage, [
        'Anchor',
        'Dragged'
      ])
      const node = await comfyPage.vueNodes.getFixtureByTitle('Dragged')

      await comfyMouse.dragElementBy(node.resize.bottomRight, {
        x: anchor.right + 5 - dragged.right
      })

      await expect
        .poll(async () => (await nodeRects(comfyPage, ['Dragged']))[0].right)
        .toBeCloseTo(anchor.right, 0)
    })

    test.describe('Resizing a group from each corner', () => {
      test.use({
        initialSettings: { 'Comfy.Canvas.SmartGuides.Enabled': false }
      })

      const corners = [
        {
          corner: 'NW',
          grab: [202, 42],
          by: [-30, -30],
          bounds: [170, 10, 430, 230]
        },
        {
          corner: 'NE',
          grab: [598, 42],
          by: [30, -30],
          bounds: [200, 10, 430, 230]
        },
        {
          corner: 'SW',
          grab: [202, 238],
          by: [-30, 30],
          bounds: [170, 40, 430, 230]
        },
        {
          corner: 'SE',
          grab: [598, 238],
          by: [30, 30],
          bounds: [200, 40, 430, 230]
        }
      ]

      for (const { corner, grab, by, bounds } of corners) {
        test(`${corner} moves only the dragged edges`, async ({
          comfyPage
        }) => {
          await comfyPage.workflow.loadWorkflow('smartGuides/group_and_note')

          await dragWithSteps(
            comfyPage,
            await canvasToClient(comfyPage, grab),
            await canvasToClient(comfyPage, [grab[0] + by[0], grab[1] + by[1]])
          )

          await expect
            .poll(() =>
              comfyPage.page.evaluate(() => [
                ...window.app!.canvas.graph!.groups[0].boundingRect
              ])
            )
            .toEqual(bounds)
        })
      }
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
  })

  test.describe('Arrange popover', () => {
    test.use({
      initialSettings: { 'Comfy.Canvas.SelectionToolbox': true }
    })

    const outerMin = (rects: NodeRect[], edge: 'left' | 'top') =>
      Math.min(...rects.map((rect) => rect[edge]))
    const outerMax = (rects: NodeRect[], edge: 'right' | 'bottom') =>
      Math.max(...rects.map((rect) => rect[edge]))
    const centreX = (rect: NodeRect) => (rect.left + rect.right) / 2
    const centreY = (rect: NodeRect) => (rect.top + rect.bottom) / 2
    const width = (rect: NodeRect) => rect.right - rect.left
    const height = (rect: NodeRect) => rect.bottom - rect.top
    const largest = (rects: NodeRect[], size: (rect: NodeRect) => number) =>
      Math.max(...rects.map(size))

    test.describe('Aligning and matching sizes', () => {
      const arrangeCases: {
        action: string
        outcome: string
        measure: (rect: NodeRect) => number
        target: (rects: NodeRect[]) => number
      }[] = [
        {
          action: 'Align left edges',
          outcome: 'the leftmost left edge',
          measure: (rect) => rect.left,
          target: (rects) => outerMin(rects, 'left')
        },
        {
          action: 'Align horizontal centers',
          outcome: 'the centre of the selection',
          measure: centreX,
          target: (rects) =>
            (outerMin(rects, 'left') + outerMax(rects, 'right')) / 2
        },
        {
          action: 'Align right edges',
          outcome: 'the rightmost right edge',
          measure: (rect) => rect.right,
          target: (rects) => outerMax(rects, 'right')
        },
        {
          action: 'Align top edges',
          outcome: 'the topmost top edge',
          measure: (rect) => rect.top,
          target: (rects) => outerMin(rects, 'top')
        },
        {
          action: 'Align vertical centers',
          outcome: 'the middle of the selection',
          measure: centreY,
          target: (rects) =>
            (outerMin(rects, 'top') + outerMax(rects, 'bottom')) / 2
        },
        {
          action: 'Align bottom edges',
          outcome: 'the lowest bottom edge',
          measure: (rect) => rect.bottom,
          target: (rects) => outerMax(rects, 'bottom')
        },
        {
          action: 'Match width',
          outcome: 'the widest width',
          measure: width,
          target: (rects) => largest(rects, width)
        },
        {
          action: 'Match height',
          outcome: 'the tallest height',
          measure: height,
          target: (rects) => largest(rects, height)
        }
      ]

      for (const { action, outcome, measure, target } of arrangeCases) {
        test(`${action} gives every node ${outcome}`, async ({ comfyPage }) => {
          await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
          const expected = target(await nodeRects(comfyPage, ROW_TITLES))

          await openArrange(comfyPage)
          await comfyPage.page.getByRole('button', { name: action }).click()

          await expect
            .poll(async () =>
              (await nodeRects(comfyPage, ROW_TITLES)).map((rect) =>
                Math.round(measure(rect))
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

        await openArrange(comfyPage)
        await comfyPage.page
          .getByRole('button', { name: 'Align top edges' })
          .click()
        await expect
          .poll(() => nodeRects(comfyPage, ROW_TITLES))
          .not.toEqual(before)

        await comfyPage.keyboard.undo()
        await expect
          .poll(() => nodeRects(comfyPage, ROW_TITLES))
          .toEqual(before)
      })
    })

    test.describe('Distributing and tuning the gaps', () => {
      test('distributing vertically evens the gaps and keeps the outer nodes in place', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_column')
        const column = async () =>
          (await nodeRects(comfyPage, ROW_TITLES)).toSorted(
            (a, b) => a.top - b.top
          )
        const before = await column()
        const heights = before.reduce(
          (sum, rect) => sum + rect.bottom - rect.top,
          0
        )
        const evenGap = Math.round(
          (before[2].bottom - before[0].top - heights) / 2
        )

        await openArrange(comfyPage)
        await comfyPage.page
          .getByRole('button', { name: 'Distribute vertically' })
          .click()

        await expect
          .poll(async () => {
            const [first, middle, last] = await column()
            return {
              firstTop: Math.round(first.top),
              lastBottom: Math.round(last.bottom),
              gaps: [
                Math.round(middle.top - first.bottom),
                Math.round(last.top - middle.bottom)
              ]
            }
          })
          .toEqual({
            firstTop: Math.round(before[0].top),
            lastBottom: Math.round(before[2].bottom),
            gaps: [evenGap, evenGap]
          })
        await expect(
          comfyPage.page.getByRole('separator', {
            name: 'Gap between distributed nodes'
          })
        ).toHaveCount(2)
      })

      test('distributing, then dragging a gap handle changes every gap and undoes in one step', async ({
        comfyPage
      }) => {
        const gaps = await distributeRow(comfyPage)
        const lefts = async () =>
          (await nodeRects(comfyPage, ROW_TITLES)).map((rect) => rect.left)
        const [evenGap] = await gapValues(gaps)
        await expect.poll(() => gapValues(gaps)).toEqual([evenGap, evenGap])
        const distributedLefts = await lefts()

        const lastHandle = await gaps.last().boundingBox()
        if (!lastHandle) throw new Error('Gap handle has no layout')
        const grip = {
          x: lastHandle.x + lastHandle.width / 2,
          y: lastHandle.y + lastHandle.height / 2
        }
        await dragWithSteps(comfyPage, grip, { x: grip.x + 30, y: grip.y })
        await expect
          .poll(() => gapValues(gaps))
          .toEqual([evenGap + 20, evenGap + 20])

        await comfyPage.keyboard.undo()
        await expect.poll(lefts).toEqual(distributedLefts)
      })

      const nudges = [
        { key: 'ArrowRight', change: 1 },
        { key: 'ArrowLeft', change: -1 },
        { key: 'ArrowUp', change: 1 },
        { key: 'Shift+ArrowLeft', change: -10 }
      ]

      for (const { key, change } of nudges) {
        test(`${key} on a focused gap handle changes every gap by ${change}`, async ({
          comfyPage
        }) => {
          const gaps = await distributeRow(comfyPage)
          const [evenGap] = await gapValues(gaps)

          await gaps.first().press(key)

          await expect
            .poll(() => gapValues(gaps))
            .toEqual([evenGap + change, evenGap + change])
        })
      }

      test('gap handles disappear once the selection changes', async ({
        comfyPage
      }) => {
        const gaps = await distributeRow(comfyPage)

        await comfyPage.canvas.click({ position: { x: 100, y: 600 } })

        await expect(gaps).toHaveCount(0)
      })
    })
  })
})
