import type { NodeId } from '@comfyorg/graph-model/nodeId'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDefaultFixture } from '@e2e/fixtures/components/WidgetSelectDefault'
import type { Rgb } from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  countColour,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  graphToClient,
  legacyWidgetPoint,
  nodeValue,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

const SET_NAME = 'model_x'

async function addNamedSetNode(comfyPage: ComfyPage) {
  const loaderId = await addPackNode(
    comfyPage,
    'CheckpointLoaderSimple',
    [40, 100]
  )
  const setId = await addPackNode(comfyPage, 'SetNode', [420, 100])
  await comfyPage.page.evaluate(
    ({ loaderId, setId, name }) => {
      const graph = window.app!.graph
      const loader = graph.getNodeById(loaderId)!
      const setNode = graph.getNodeById(setId)!
      loader.connect(0, setNode, 0)
      const constant = setNode.widgets![0]
      constant.value = name
      constant.callback?.(name)
    },
    { loaderId, setId, name: SET_NAME }
  )
  await expect
    .poll(() => nodeValue(comfyPage, setId, ['inputs', '0', 'type']))
    .toBe('MODEL')
  return setId
}

async function pickGetConstant(comfyPage: ComfyPage, getId: NodeId) {
  if (comfyPage.isVueNodes) {
    await new WidgetSelectDefaultFixture(
      comfyPage.vueNodes.getNodeLocator(getId),
      'Constant'
    ).selectOption(SET_NAME)
    return
  }
  const width = (await nodeValue(comfyPage, getId, ['size', '0'])) as number
  const combo = await legacyWidgetPoint(
    comfyPage,
    getId,
    'Constant',
    width / 2,
    10
  )
  await comfyPage.page.mouse.click(combo.x, combo.y)
  await comfyPage.page
    .locator('.litecontextmenu .litemenu-entry', { hasText: SET_NAME })
    .click()
}

function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!match) throw new Error(`Link colour ${hex} is not #rrggbb`)
  return [
    parseInt(match[1], 16),
    parseInt(match[2], 16),
    parseInt(match[3], 16)
  ]
}

async function editorCanvasCentre(comfyPage: ComfyPage, nodeId: NodeId) {
  const target = await comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)!
    const canvas = node
      .widgets!.map((widget) =>
        'element' in widget && widget.element instanceof HTMLElement
          ? widget.element.querySelector('canvas')
          : null
      )
      .find((element) => element !== null)
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = rect.x + rect.width * 0.6
    const y = rect.y + rect.height * 0.3
    return { x, y, hitsEditor: document.elementFromPoint(x, y) === canvas }
  }, nodeId)
  expect(target, 'editor canvas is in the page').not.toBeNull()
  expect(target!.hitsEditor, 'nothing covers the editor canvas').toBe(true)
  return { x: target!.x, y: target!.y }
}

async function shiftClick(comfyPage: ComfyPage, at: { x: number; y: number }) {
  const { keyboard, mouse } = comfyPage.page
  await mouse.move(at.x, at.y)
  await keyboard.down('Shift')
  await mouse.down()
  await mouse.up()
  await keyboard.up('Shift')
}

async function pointsStore(comfyPage: ComfyPage, nodeId: NodeId) {
  const raw = await comfyPage.page.evaluate(
    (id) =>
      window
        .app!.graph.getNodeById(id)!
        .widgets!.find((widget) => widget.name === 'points_store')!.value,
    nodeId
  )
  return JSON.parse(String(raw)) as unknown
}

async function helpButtonCentre(comfyPage: ComfyPage, nodeId: NodeId) {
  const button = comfyPage.vueNodes
    .getNodeLocator(nodeId)
    .locator('.kj-help-btn')
  await expect(button).toBeVisible()
  const box = await button.boundingBox()
  if (!box) throw new Error('help button has no box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

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
          await nodeValue(comfyPage, id, ['pos', '0']),
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
