import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

import {
  BLUE,
  GREEN,
  PACK_RENDERERS,
  PACK_TAGS,
  RED,
  addPackNode,
  countColour,
  dispatchPackEvent,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  nodeScreenRect,
  showEmptyGraphAtZoomOne,
  tetrisPiecePixels,
  widgetState
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  clickButtonWidget,
  nodeLocalPoint,
  nodeLocalRect
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a1'
import {
  BLACK,
  FOLDER_PANEL_GREY,
  GRADIENT_BAR_LEFT,
  GRADIENT_BAR_TOP,
  gradientStops,
  gradientBarPoint
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.fillNodes'

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `ComfyUI_Fill-Nodes on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await expectPackLoaded(comfyPage, 'ComfyUI_Fill-Nodes')
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Gradient Image Generator draws its gradient preview', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, 'FL_GradGenerator', [200, 160])
        const bar = await nodeLocalRect(comfyPage, id, [
          GRADIENT_BAR_LEFT,
          GRADIENT_BAR_TOP,
          260,
          40
        ])

        await expect
          .poll(() => countColour(comfyPage, bar, RED, 60), {
            message: 'red end of the gradient'
          })
          .toBeGreaterThan(350)
        expect(await countColour(comfyPage, bar, GREEN, 60)).toBeGreaterThan(
          700
        )
        expect(await countColour(comfyPage, bar, BLUE, 60)).toBeGreaterThan(350)
      })

      test('Gradient Image Generator adds a stop on click and drops a picked stop on release', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, 'FL_GradGenerator', [200, 160])
        expect(await gradientStops(comfyPage, id)).toEqual([0, 0.5, 1])
        const quarter = await gradientBarPoint(comfyPage, id, 0.25)

        await comfyPage.page.mouse.click(quarter.x, quarter.y)
        await expect
          .poll(() => gradientStops(comfyPage, id), {
            message: 'click on the bar adds a stop'
          })
          .toEqual([0, 0.25, 0.5, 1])

        await comfyPage.page.mouse.click(quarter.x, quarter.y)
        const elsewhere = await gradientBarPoint(comfyPage, id, 0.8)
        await comfyPage.page.mouse.move(elsewhere.x, elsewhere.y, { steps: 6 })
        await comfyPage.nextFrame()

        expect(
          await gradientStops(comfyPage, id),
          'released stop stays where it was dropped'
        ).toEqual([0, 0.25, 0.5, 1])
      })

      test('Bullet Hell draws its game field with the ship and enemies', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'FL_BulletHellGame',
          [150, 200],
          [600, 400]
        )
        await comfyPage.canvasOps.moveMouseToEmptyArea()
        const field = await nodeLocalRect(comfyPage, id, [23, 53, 554, 324])

        await expect
          .poll(() => countColour(comfyPage, field, BLACK, 8), {
            message: 'black game field'
          })
          .toBeGreaterThan(60_000)
        await expect
          .poll(() => countColour(comfyPage, field, RED, 40), {
            message: 'red enemies'
          })
          .toBeGreaterThan(70)
        await expect
          .poll(() => countColour(comfyPage, field, [0, 255, 0], 40), {
            message: 'lime ship'
          })
          .toBeGreaterThan(9)
      })

      test('Tetris draws its playfield with a falling piece', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'FL_TetrisGame',
          [300, 170],
          [290, 450]
        )
        const board = await nodeLocalRect(comfyPage, id, [10, 40, 204, 404])
        const interior = await nodeLocalRect(comfyPage, id, [14, 44, 196, 396])
        await expect
          .poll(() => tetrisPiecePixels(comfyPage, interior), {
            message: 'coloured falling piece inside the playfield'
          })
          .toBeGreaterThan(100)

        await expect
          .poll(() => countColour(comfyPage, board, BLACK, 8), {
            message: 'black playfield'
          })
          .toBeGreaterThan(25_000)
        await expect
          .poll(
            async () =>
              (await countColour(comfyPage, board, [255, 255, 255], 8)) > 800,
            { message: 'white board border' }
          )
          .toBe(true)
      })

      test('Image Adjuster draws the adjusted image it receives (fl_image_adjuster event)', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'FL_ImageAdjuster',
          [200, 160],
          [300, 420]
        )
        const image = await comfyPage.page.evaluate(() => {
          const canvas = document.createElement('canvas')
          canvas.width = 128
          canvas.height = 128
          const context = canvas.getContext('2d')!
          context.fillStyle = '#ff0000'
          context.fillRect(0, 0, 128, 128)
          return canvas.toDataURL('image/png')
        })
        await dispatchPackEvent(comfyPage, 'fl_image_adjuster', { image })

        await expect
          .poll(
            async () =>
              countColour(comfyPage, await nodeScreenRect(comfyPage, id), RED),
            { message: 'adjusted image preview' }
          )
          .toBeGreaterThan(20_000)
      })

      test('Save Images shows its folder tree and removes the folder picked in it', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, 'FL_SaveImages', [200, 120])
        await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          node.widgets!.find(
            (widget) => widget.name === 'folder_structure'
          )!.value = JSON.stringify([
            { name: 'aaa', children: [] },
            { name: 'bbb', children: [] }
          ])
        }, id)
        await clickButtonWidget(comfyPage, id, 'Refresh Folder Structure')
        await comfyPage.canvasOps.moveMouseToEmptyArea()
        const panel = await nodeLocalRect(comfyPage, id, [0, 250, 350, 100])

        await expect
          .poll(() => countColour(comfyPage, panel, FOLDER_PANEL_GREY, 3), {
            message: 'folder tree panel drawn'
          })
          .toBeGreaterThan(9_000)

        const bbb = await nodeLocalPoint(comfyPage, id, [60, 310])
        await comfyPage.page.mouse.click(bbb.x, bbb.y)
        await clickButtonWidget(comfyPage, id, 'Remove Selected Folder')

        await expect
          .poll(() => widgetState(comfyPage, id, 'folder_structure', ['value']))
          .toBe(JSON.stringify([{ name: 'aaa', children: [] }]))
      })
    }
  )
}
