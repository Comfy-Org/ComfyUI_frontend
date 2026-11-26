import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position, Size } from '@e2e/fixtures/types'
import { openAlign } from '@e2e/fixtures/utils/selectionToolbox'

type Bounds = Position & Size

const ROW_TITLES = ['A', 'B', 'C']
const GAP_HANDLE = { name: 'Gap between distributed nodes' }

async function boundsOf(comfyPage: ComfyPage, titles: string[]) {
  return Promise.all(
    titles.map(async (title) =>
      (await comfyPage.nodeOps.getNodeRefByTitle(title)).getBounding()
    )
  )
}

async function leftsOf(comfyPage: ComfyPage, titles: string[]) {
  return (await boundsOf(comfyPage, titles)).map(({ x }) => Math.round(x))
}

async function arrange(comfyPage: ComfyPage, action: string) {
  await comfyPage.keyboard.selectAll()
  await openAlign(comfyPage)
  await comfyPage.page.getByRole('button', { name: action }).click()
}

async function distributeRow(comfyPage: ComfyPage) {
  await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
  await arrange(comfyPage, 'Distribute horizontally')
  const gaps = comfyPage.page.getByRole('separator', GAP_HANDLE)
  await expect(gaps).toHaveCount(2)
  return gaps
}

function gapValues(comfyPage: ComfyPage) {
  return comfyPage.page
    .getByRole('separator', GAP_HANDLE)
    .evaluateAll((handles) =>
      handles.map((handle) => Number(handle.getAttribute('aria-valuenow')))
    )
}

async function centreOf(comfyPage: ComfyPage, index: number) {
  const box = await comfyPage.page
    .getByRole('separator', GAP_HANDLE)
    .nth(index)
    .boundingBox()
  if (!box) throw new Error('Gap handle has no layout')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test.describe('Smart guides', { tag: ['@vue-nodes', '@canvas'] }, () => {
  test.describe('Dragging a node 5 units left of another node’s left edge', () => {
    const cases = [
      { name: 'snaps onto the edge', settings: {}, keys: [], left: 55 },
      {
        name: 'stays put while Shift is held',
        settings: { 'Comfy.SnapToGrid.GridSize': 1 },
        keys: ['Shift'],
        left: 50
      },
      {
        name: 'stays put when smart guides are off',
        settings: { 'Comfy.Canvas.SmartGuides.Enabled': false },
        keys: [],
        left: 50
      },
      {
        name: 'stays put when edge snapping is off',
        settings: { 'Comfy.Canvas.SmartGuides.SnapToEdges': false },
        keys: [],
        left: 50
      }
    ]

    for (const { name, settings, keys, left } of cases) {
      test.describe(name, () => {
        test.use({ initialSettings: settings })

        test(`lands at left ${left}`, async ({ comfyPage, comfyMouse }) => {
          await comfyPage.workflow.loadWorkflow('smartGuides/two_notes')
          const dragged = await comfyPage.vueNodes.getFixtureByTitle('Dragged')

          for (const key of keys) await comfyPage.page.keyboard.down(key)
          await comfyMouse.dragElementBy(dragged.header, { x: -5, y: 60 })

          await expect
            .poll(() => leftsOf(comfyPage, ['Dragged']))
            .toEqual([left])
        })
      })
    }
  })

  test.describe('Dropping a node 5 units below its wire’s level', () => {
    const cases = [
      { name: 'straightens the wire', wires: true, offset: 0 },
      {
        name: 'leaves the wire when wire snapping is off',
        wires: false,
        offset: 5
      }
    ]

    for (const { name, wires, offset } of cases) {
      test.describe(name, () => {
        test.use({
          initialSettings: {
            'Comfy.Canvas.SmartGuides.SnapToEdges': false,
            'Comfy.Canvas.SmartGuides.SnapToSpacing': false,
            'Comfy.Canvas.SmartGuides.SnapToWires': wires
          }
        })

        test(`ends ${offset} units off level`, async ({
          comfyPage,
          comfyMouse
        }) => {
          await comfyPage.workflow.loadWorkflow(
            'smartGuides/checkpoint_to_vae_decode'
          )
          function slotOffset() {
            return comfyPage.page.evaluate(() => {
              const graph = window.app!.canvas.graph!
              const checkpoint = graph.nodes.find(
                (n) => n.title === 'Load Checkpoint'
              )!
              const decode = graph.nodes.find((n) => n.title === 'VAE Decode')!
              return decode.getInputPos(1)[1] - checkpoint.getOutputPos(2)[1]
            })
          }
          const decode =
            await comfyPage.vueNodes.getFixtureByTitle('VAE Decode')

          await comfyMouse.dragElementBy(decode.header, {
            x: 0,
            y: 5 - (await slotOffset())
          })

          await expect.poll(slotOffset).toBeCloseTo(offset, 0)
        })
      })
    }
  })

  test.describe('Dragging a node just past the gap two neighbours already have', () => {
    const cases = [
      { name: 'repeats the gap', spacing: true, left: 580 },
      { name: 'stays put when spacing snap is off', spacing: false, left: 585 }
    ]

    for (const { name, spacing, left } of cases) {
      test.describe(name, () => {
        test.use({
          initialSettings: { 'Comfy.Canvas.SmartGuides.SnapToSpacing': spacing }
        })

        test(`lands at left ${left}`, async ({ comfyPage, comfyMouse }) => {
          await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
          const node = await comfyPage.vueNodes.getFixtureByTitle('C')

          await comfyMouse.dragElementBy(node.header, { x: -15, y: 0 })

          await expect.poll(() => leftsOf(comfyPage, ['C'])).toEqual([left])
        })
      })
    }
  })

  test.describe('Resizing a node 5 units past a neighbour’s right edge', () => {
    const cases = [
      { name: 'snaps onto the edge', settings: {}, keys: [], right: 375 },
      {
        name: 'stays put while Shift is held',
        settings: { 'Comfy.SnapToGrid.GridSize': 1 },
        keys: ['Shift'],
        right: 380
      }
    ]

    for (const { name, settings, keys, right } of cases) {
      test.describe(name, () => {
        test.use({ initialSettings: settings })

        test(`ends with its right edge at ${right}`, async ({
          comfyPage,
          comfyMouse
        }) => {
          await comfyPage.workflow.loadWorkflow('smartGuides/two_notes')
          const node = await comfyPage.vueNodes.getFixtureByTitle('Dragged')

          async function rightEdge() {
            const [{ x, width }] = await boundsOf(comfyPage, ['Dragged'])
            return Math.round(x + width)
          }
          const startRight = await rightEdge()

          for (const key of keys) await comfyPage.page.keyboard.down(key)
          await comfyMouse.dragElementBy(node.resize.bottomRight, {
            x: 380 - startRight
          })

          await expect.poll(rightEdge).toBe(right)
        })
      })
    }
  })

  test.describe('Resizing a group', () => {
    async function dragCanvas(
      comfyPage: ComfyPage,
      from: [number, number],
      to: [number, number]
    ) {
      await comfyPage.canvasOps.dragAndDrop(
        await comfyPage.canvasOps.canvasPosToClientPos(from),
        await comfyPage.canvasOps.canvasPosToClientPos(to)
      )
    }

    test.describe('without smart guides', () => {
      test.use({
        initialSettings: { 'Comfy.Canvas.SmartGuides.Enabled': false }
      })

      const corners: {
        corner: string
        from: [number, number]
        to: [number, number]
        bounds: Bounds
      }[] = [
        {
          corner: 'NW',
          from: [202, 42],
          to: [172, 12],
          bounds: { x: 170, y: 10, width: 430, height: 230 }
        },
        {
          corner: 'SE',
          from: [598, 238],
          to: [628, 268],
          bounds: { x: 200, y: 40, width: 430, height: 230 }
        }
      ]

      for (const { corner, from, to, bounds } of corners) {
        test(`from ${corner} moves only the dragged edges`, async ({
          comfyPage
        }) => {
          await comfyPage.workflow.loadWorkflow('smartGuides/group_and_note')

          await dragCanvas(comfyPage, from, to)

          await expect
            .poll(() => comfyPage.canvasOps.getGroupBounds('Group'))
            .toEqual(bounds)
        })
      }
    })

    test('from NW snaps its left edge to a node and keeps the opposite corner', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('smartGuides/group_and_note')

      await dragCanvas(comfyPage, [202, 42], [49, 42])

      await expect
        .poll(() => comfyPage.canvasOps.getGroupBounds('Group'))
        .toEqual({ x: 50, y: 40, width: 550, height: 200 })
    })
  })

  test.describe('Align popover', () => {
    test.use({
      initialSettings: { 'Comfy.Canvas.SelectionToolbox': true }
    })

    test.describe('Aligning and matching sizes', () => {
      const cases: {
        action: string
        measure: (bounds: Bounds) => number
        expected: number
      }[] = [
        { action: 'Align left edges', measure: (b) => b.x, expected: 50 },
        {
          action: 'Align horizontal centers',
          measure: (b) => b.x + b.width / 2,
          expected: 465
        },
        {
          action: 'Align right edges',
          measure: (b) => b.x + b.width,
          expected: 880
        },
        { action: 'Match width', measure: (b) => b.width, expected: 280 }
      ]

      for (const { action, measure, expected } of cases) {
        test(`${action} lines every node up at ${expected}`, async ({
          comfyPage
        }) => {
          await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')

          await arrange(comfyPage, action)

          await expect
            .poll(async () =>
              (await boundsOf(comfyPage, ROW_TITLES)).map((b) =>
                Math.round(measure(b))
              )
            )
            .toEqual([expected, expected, expected])
        })
      }

      test('undo after aligning restores the original layout', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
        const before = await boundsOf(comfyPage, ROW_TITLES)

        await arrange(comfyPage, 'Align top edges')
        await expect
          .poll(() => boundsOf(comfyPage, ROW_TITLES))
          .not.toEqual(before)

        await comfyPage.keyboard.undo()
        await expect.poll(() => boundsOf(comfyPage, ROW_TITLES)).toEqual(before)
      })
    })

    test.describe('Buttons that cannot act are disabled', () => {
      test('every action is disabled on a locked canvas', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
        await comfyPage.keyboard.selectAll()
        await comfyPage.command.executeCommand('Comfy.Canvas.Lock')

        await openAlign(comfyPage)

        await expect(
          comfyPage.page.getByRole('button', { name: 'Align left edges' })
        ).toBeDisabled()
        await expect(
          comfyPage.page.getByRole('button', {
            name: 'Distribute horizontally'
          })
        ).toBeDisabled()
      })

      test('distribute needs three movable nodes, so a pinned one disables it', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
        await comfyPage.nodeOps.selectNodes(['B'])
        await comfyPage.command.executeCommand(
          'Comfy.Canvas.ToggleSelectedNodes.Pin'
        )
        await comfyPage.keyboard.selectAll()

        await openAlign(comfyPage)

        await expect(
          comfyPage.page.getByRole('button', {
            name: 'Distribute horizontally'
          })
        ).toBeDisabled()
        await expect(
          comfyPage.page.getByRole('button', { name: 'Align left edges' })
        ).toBeEnabled()
      })
    })

    test.describe('Distributing and tuning the gaps', () => {
      test('distributing evens the gaps and keeps the outer nodes in place', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
        const [first, middle, last] = await boundsOf(comfyPage, ROW_TITLES)
        const span = last.x + last.width - first.x
        const evenGap = Math.round(
          (span - first.width - middle.width - last.width) / 2
        )

        await arrange(comfyPage, 'Distribute horizontally')

        await expect
          .poll(async () => {
            const [a, b, c] = await boundsOf(comfyPage, ROW_TITLES)
            return [
              Math.round(a.x),
              Math.round(b.x - (a.x + a.width)),
              Math.round(c.x - (b.x + b.width)),
              Math.round(c.x + c.width)
            ]
          })
          .toEqual([
            Math.round(first.x),
            evenGap,
            evenGap,
            Math.round(last.x + last.width)
          ])
        await expect(
          comfyPage.page.getByRole('separator', GAP_HANDLE)
        ).toHaveCount(2)
      })

      test('distributing across overlapping nodes leaves them and shows no gap handles', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('smartGuides/three_notes_row')
        async function topsOf() {
          return (await boundsOf(comfyPage, ROW_TITLES)).map(({ y }) =>
            Math.round(y)
          )
        }
        const before = await topsOf()

        await arrange(comfyPage, 'Distribute vertically')
        await comfyPage.nextFrame()

        await expect(
          comfyPage.page.getByRole('separator', GAP_HANDLE)
        ).toHaveCount(0)
        expect(await topsOf()).toEqual(before)
      })

      test('dragging a gap handle changes every gap and undoes in one step', async ({
        comfyPage
      }) => {
        await distributeRow(comfyPage)
        const [evenGap] = await gapValues(comfyPage)
        const distributed = await leftsOf(comfyPage, ROW_TITLES)
        const grip = await centreOf(comfyPage, 1)

        await comfyPage.canvasOps.dragAndDrop(grip, {
          x: grip.x + 30,
          y: grip.y
        })
        await expect
          .poll(() => gapValues(comfyPage))
          .toEqual([evenGap + 20, evenGap + 20])

        await comfyPage.keyboard.undo()
        await expect
          .poll(() => leftsOf(comfyPage, ROW_TITLES))
          .toEqual(distributed)
      })

      test('tapping Shift mid-drag still undoes the whole drag in one step', async ({
        comfyPage
      }) => {
        await distributeRow(comfyPage)
        const distributed = await leftsOf(comfyPage, ROW_TITLES)
        const grip = await centreOf(comfyPage, 1)
        const { mouse, keyboard } = comfyPage.page

        await mouse.move(grip.x, grip.y)
        await mouse.down()
        await mouse.move(grip.x + 15, grip.y, { steps: 10 })
        await keyboard.press('Shift')
        await mouse.move(grip.x + 30, grip.y, { steps: 10 })
        await mouse.up()
        await expect
          .poll(() => leftsOf(comfyPage, ROW_TITLES))
          .not.toEqual(distributed)

        await comfyPage.keyboard.undo()
        await expect
          .poll(() => leftsOf(comfyPage, ROW_TITLES))
          .toEqual(distributed)
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
          const [evenGap] = await gapValues(comfyPage)

          await gaps.first().press(key)

          await expect
            .poll(() => gapValues(comfyPage))
            .toEqual([evenGap + change, evenGap + change])
        })
      }

      test('holding ArrowRight on a gap handle undoes in one step', async ({
        comfyPage
      }) => {
        const gaps = await distributeRow(comfyPage)
        const [evenGap] = await gapValues(comfyPage)
        const distributed = await leftsOf(comfyPage, ROW_TITLES)
        const { keyboard } = comfyPage.page

        await gaps.first().focus()
        for (const _ of [1, 2, 3, 4, 5]) await keyboard.down('ArrowRight')
        await keyboard.up('ArrowRight')
        await expect
          .poll(() => gapValues(comfyPage))
          .toEqual([evenGap + 5, evenGap + 5])

        await comfyPage.keyboard.undo()
        await expect
          .poll(() => leftsOf(comfyPage, ROW_TITLES))
          .toEqual(distributed)
      })

      test('gap handles disappear once the distributed nodes are pinned', async ({
        comfyPage
      }) => {
        const gaps = await distributeRow(comfyPage)

        await comfyPage.command.executeCommand(
          'Comfy.Canvas.ToggleSelectedNodes.Pin'
        )

        await expect(gaps).toHaveCount(0)
      })

      test('Tidy up replaces the distribute gap handles', async ({
        comfyPage
      }) => {
        const gaps = await distributeRow(comfyPage)

        await comfyPage.selectionToolbox
          .getByRole('button', { name: 'Tidy up', exact: true })
          .click()

        await expect(gaps).toHaveCount(0)
      })

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

test.describe('Smart guides on the classic canvas', { tag: '@canvas' }, () => {
  test('dragging a node snaps it onto another node’s left edge', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('smartGuides/two_notes')
    const dragged = await comfyPage.nodeOps.getNodeRefByTitle('Dragged')

    await dragged.dragBy({ x: -5, y: 60 })

    await expect.poll(() => leftsOf(comfyPage, ['Dragged'])).toEqual([55])
  })

  test('resizing a node snaps its right edge onto a neighbour’s', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('smartGuides/two_notes')
    const dragged = await comfyPage.nodeOps.getNodeRefByTitle('Dragged')
    async function rightEdge() {
      const { x, width } = await dragged.getBounding()
      return Math.round(x + width)
    }
    const { x, y, width, height } = await dragged.getBounding()
    const corner: [number, number] = [x + width - 3, y + height - 3]

    await comfyPage.canvasOps.dragAndDrop(
      await comfyPage.canvasOps.canvasPosToClientPos(corner),
      await comfyPage.canvasOps.canvasPosToClientPos([
        corner[0] + 380 - (x + width),
        corner[1]
      ])
    )

    await expect.poll(rightEdge).toBe(375)
  })
})
