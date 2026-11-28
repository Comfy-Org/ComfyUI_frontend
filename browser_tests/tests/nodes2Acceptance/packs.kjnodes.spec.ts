import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

import {
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  countColour,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  graphToClient,
  nodeValue,
  nodeGeometry,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  SET_NAME,
  addNamedSetNode,
  pickGetConstant,
  hexToRgb,
  editorCanvasCentre,
  shiftClick,
  pointsStore,
  helpButtonCentre
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.kjnodes'

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `ComfyUI-KJNodes on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'ComfyUI-KJNodes')
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Get node takes the name, title and type of a Set node picked from its combo', async ({
        comfyPage
      }) => {
        await addNamedSetNode(comfyPage)
        const getId = await addPackNode(comfyPage, 'GetNode', [420, 400])

        await pickGetConstant(comfyPage, getId)

        await expect
          .poll(() => nodeValue(comfyPage, getId, ['widgets', '0', 'value']))
          .toBe(SET_NAME)
        expect(await nodeValue(comfyPage, getId, ['title'])).toBe(
          `Get_${SET_NAME}`
        )
        expect(
          await nodeValue(comfyPage, getId, ['outputs', '0', 'type'])
        ).toBe('MODEL')
      })

      test('Set node with Show connections (drawConnection) draws a virtual link to its Get node', async ({
        comfyPage
      }) => {
        const setId = await addNamedSetNode(comfyPage)
        const getId = await addPackNode(comfyPage, 'GetNode', [900, 500])
        const linkHex = await comfyPage.page.evaluate(
          ({ getId, name }) => {
            const getNode = window.app!.graph.getNodeById(getId)!
            const setName: unknown = Reflect.get(getNode, 'setName')
            if (typeof setName === 'function') setName.call(getNode, name)
            const byType = window.app!.canvas.default_connection_color_byType
            return String(
              Object.hasOwn(byType, 'MODEL')
                ? byType.MODEL
                : window.LiteGraph!.LGraphCanvas.link_type_colors.MODEL
            )
          },
          { getId, name: SET_NAME }
        )
        const linkColour = hexToRgb(linkHex)
        const topLeft = await graphToClient(comfyPage, [700, 220])
        const bottomRight = await graphToClient(comfyPage, [860, 460])
        const between = {
          x: topLeft.x,
          y: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y
        }
        const hidden = await countColour(comfyPage, between, linkColour, 12)

        await comfyPage.page.evaluate((id) => {
          Reflect.set(
            window.app!.graph.getNodeById(id)!,
            'drawConnection',
            true
          )
        }, setId)

        await expect
          .poll(
            async () =>
              (await countColour(comfyPage, between, linkColour, 12)) - hidden,
            { message: 'virtual link pixels between Set and Get' }
          )
          .toBeGreaterThan(100)
      })

      test('Spline Editor adds a control point on Shift+click', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, 'SplineEditor', [100, 20])
        const countPoints = async () => {
          const splines = (await pointsStore(comfyPage, id)) as {
            points: unknown[]
          }[]
          return splines.reduce((sum, spline) => sum + spline.points.length, 0)
        }
        await expect.poll(countPoints).toBeGreaterThan(0)
        const before = await countPoints()

        await shiftClick(comfyPage, await editorCanvasCentre(comfyPage, id))

        await expect.poll(countPoints).toBe(before + 1)
        expect(
          (await nodeGeometry(comfyPage, id)).pos[0],
          'node stays put'
        ).toBe(100)
      })

      test('Points Editor adds a positive point on Shift+click', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, 'PointsEditor', [100, 20])
        const positives = async () =>
          ((await pointsStore(comfyPage, id)) as { positive: unknown[] })
            .positive.length
        await expect.poll(positives).toBeGreaterThan(0)
        const before = await positives()

        await shiftClick(comfyPage, await editorCanvasCentre(comfyPage, id))

        await expect.poll(positives).toBe(before + 1)
      })

      test('clicking the centre of the help "?" opens the node description', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'BlockifyMask',
          [200, 200],
          [320, 120]
        )
        const target = comfyPage.isVueNodes
          ? await helpButtonCentre(comfyPage, id)
          : await comfyPage.page
              .evaluate((nodeId) => {
                const node = window.app!.graph.getNodeById(nodeId)!
                return [
                  node.pos[0] + node.size[0] - 11,
                  node.pos[1] - 13
                ] as const
              }, id)
              .then((point) => graphToClient(comfyPage, point))

        await comfyPage.page.mouse.click(target.x, target.y)

        await expect(
          comfyPage.page.locator('.kj-documentation-popup')
        ).toBeVisible()
      })
    }
  )
}
