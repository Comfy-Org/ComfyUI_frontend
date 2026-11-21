import type { NodeId } from '@comfyorg/graph-model/nodeId'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  MAGENTA,
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  countColour,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  nodeValue,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  countQueueCalls,
  nodeLocalPoint,
  nodeLocalRect,
  queueCalls,
  selectedNodeIds
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a1'

const SLIDER_TRACK_LEFT = 10
const SLIDER_TRACK_RIGHT_INSET = 60

async function paintKnobMagenta(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    window.LiteGraph!.NODE_TEXT_COLOR = '#ff00ff'
  })
}

async function nodeSize(comfyPage: ComfyPage, id: NodeId) {
  return comfyPage.page.evaluate((nodeId) => {
    const node = window.app!.graph.getNodeById(nodeId)!
    return [node.size[0], node.size[1]]
  }, id)
}

async function widgetValues(comfyPage: ComfyPage, id: NodeId) {
  return comfyPage.page.evaluate(
    (nodeId) =>
      Object.fromEntries(
        window
          .app!.graph.getNodeById(nodeId)!
          .widgets!.map((widget) => [widget.name, widget.value])
      ),
    id
  )
}

async function drag(
  comfyPage: ComfyPage,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  const { mouse } = comfyPage.page
  await mouse.move(from.x, from.y)
  await mouse.down()
  await mouse.move(to.x, to.y, { steps: 8 })
  await mouse.up()
}

async function titleButtonRect(comfyPage: ComfyPage, id: NodeId) {
  const [x, y, width, height] = await comfyPage.page.evaluate((nodeId) => {
    const LiteGraph = window.LiteGraph!
    const node = window.app!.graph.getNodeById(nodeId)!
    const titleHeight = LiteGraph.NODE_TITLE_HEIGHT
    const buttonWidth = LiteGraph.NODE_COLLAPSED_WIDTH - titleHeight - 6
    return [
      node.size[0] - buttonWidth - 6,
      2 - titleHeight,
      buttonWidth,
      titleHeight - 4
    ] as const
  }, id)
  return nodeLocalRect(comfyPage, id, [x, y, width, height])
}

async function clickTitleButton(comfyPage: ComfyPage, id: NodeId) {
  const button = await titleButtonRect(comfyPage, id)
  await comfyPage.page.mouse.click(
    button.x + button.width / 2,
    button.y + button.height / 2
  )
}

async function titleButtonIconPixels(comfyPage: ComfyPage, id: NodeId) {
  await comfyPage.page.mouse.move(5, 5)
  await comfyPage.page.evaluate((nodeId) => {
    window.app!.graph.getNodeById(nodeId)!.boxcolor = '#ff00ff'
  }, id)
  return countColour(
    comfyPage,
    await titleButtonRect(comfyPage, id),
    MAGENTA,
    30
  )
}

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `ComfyUI-mxToolkit on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await expectPackLoaded(comfyPage, 'ComfyUI-mxToolkit')
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Slider draws its knob and commits the dragged value on release', async ({
        comfyPage
      }) => {
        await paintKnobMagenta(comfyPage)
        const id = await addPackNode(comfyPage, 'mxSlider', [200, 200])
        const track = SLIDER_TRACK_LEFT
        const trackWidth = 210 - SLIDER_TRACK_RIGHT_INSET - SLIDER_TRACK_LEFT
        expect((await nodeSize(comfyPage, id))[0]).toBe(210)
        expect(await widgetValues(comfyPage, id)).toMatchObject({ Xi: 20 })

        await drag(
          comfyPage,
          await nodeLocalPoint(comfyPage, id, [track + trackWidth * 0.2, 14]),
          await nodeLocalPoint(comfyPage, id, [track + trackWidth * 0.8, 14])
        )

        await expect
          .poll(() => widgetValues(comfyPage, id), {
            message: 'Xi/Xf committed by onMouseUp'
          })
          .toMatchObject({ Xi: 80, Xf: 80 })
        await comfyPage.page.mouse.move(5, 5)
        const knob = await nodeLocalRect(comfyPage, id, [
          track + trackWidth * 0.8 - 10,
          4,
          20,
          20
        ])
        await expect
          .poll(() => countColour(comfyPage, knob, MAGENTA, 30), {
            message: 'knob drawn at 80%'
          })
          .toBeGreaterThan(40)
      })

      test('Slider 2D draws its knob and commits the dragged point on release', async ({
        comfyPage
      }) => {
        await paintKnobMagenta(comfyPage)
        const id = await addPackNode(comfyPage, 'mxSlider2D', [200, 150])
        expect(await nodeSize(comfyPage, id)).toEqual([210, 160])
        expect(await widgetValues(comfyPage, id)).toMatchObject({
          Xi: 512,
          Yi: 512
        })
        const area = 140
        const target = [10 + area * 0.125, 10 + area * 0.125] as const

        await drag(
          comfyPage,
          await nodeLocalPoint(comfyPage, id, [80, 80]),
          await nodeLocalPoint(comfyPage, id, target)
        )

        await expect
          .poll(() => widgetValues(comfyPage, id), {
            message: 'Xi/Yi committed by onMouseUp'
          })
          .toMatchObject({ Xi: 128, Xf: 128, Yi: 896, Yf: 896 })
        await comfyPage.page.mouse.move(5, 5)
        const knob = await nodeLocalRect(comfyPage, id, [
          target[0] - 10,
          target[1] - 10,
          20,
          20
        ])
        await expect
          .poll(() => countColour(comfyPage, knob, MAGENTA, 30), {
            message: 'knob drawn at the dragged point'
          })
          .toBeGreaterThan(40)
      })

      test('Seed title button is drawn and a click picks a new seed and queues', async ({
        comfyPage
      }) => {
        await countQueueCalls(comfyPage)
        const id = await addPackNode(comfyPage, 'mxSeed', [200, 200])
        expect(await widgetValues(comfyPage, id)).toMatchObject({ X: 0 })

        await clickTitleButton(comfyPage, id)

        await expect
          .poll(() => queueCalls(comfyPage))
          .toEqual({ queuePrompt: 1, interrupt: 1 })
        const seed = await nodeValue(comfyPage, id, ['properties', 'seed'])
        expect(seed, 'new seed').not.toBe(0)
        expect(await widgetValues(comfyPage, id)).toMatchObject({ X: seed })
        await expect
          .poll(() => titleButtonIconPixels(comfyPage, id), {
            message: 'run button drawn in the title bar'
          })
          .toBeGreaterThan(30)
      })

      test('Stop title button is drawn and a click queues the workflow', async ({
        comfyPage
      }) => {
        await countQueueCalls(comfyPage)
        const id = await addPackNode(comfyPage, 'mxStop', [200, 200])

        await clickTitleButton(comfyPage, id)

        await expect
          .poll(() => queueCalls(comfyPage))
          .toEqual({ queuePrompt: 1, interrupt: 0 })
        await expect
          .poll(() => titleButtonIconPixels(comfyPage, id), {
            message: 'pause button drawn in the title bar'
          })
          .toBeGreaterThan(30)
      })

      test('Reroute is a titleless dot whose input sits at the top centre when inputDir is UP', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, 'mxReroute', [300, 300])
        await comfyPage.page.evaluate((nodeId) => {
          window.app!.graph.getNodeById(nodeId)!.setProperty('inputDir', 'UP')
        }, id)
        await comfyPage.nextFrame()
        const [width, height] = await nodeSize(comfyPage, id)

        await expect
          .poll(
            () =>
              comfyPage.page.evaluate((nodeId) => {
                const node = window.app!.graph.getNodeById(nodeId)!
                const [x, y] = node.getInputPos(0)
                return [
                  Math.round(x - node.pos[0]),
                  Math.round(y - node.pos[1])
                ]
              }, id),
            { message: 'input link point, relative to node.pos' }
          )
          .toEqual([Math.round(width / 2), 0])

        const dot = await nodeLocalPoint(comfyPage, id, [width / 2, height / 2])
        await comfyPage.page.mouse.click(dot.x, dot.y)
        await expect.poll(() => selectedNodeIds(comfyPage)).toEqual([id])
        const empty = await nodeLocalPoint(comfyPage, id, [width / 2, 300])
        await comfyPage.page.mouse.click(empty.x, empty.y)
        await expect.poll(() => selectedNodeIds(comfyPage)).toEqual([])

        const besideDot = await nodeLocalPoint(comfyPage, id, [
          width + 40,
          height / 2
        ])
        await comfyPage.page.mouse.click(besideDot.x, besideDot.y)
        await expect
          .poll(() => selectedNodeIds(comfyPage), {
            message: 'a click beside the dot does not hit the reroute'
          })
          .toEqual([])
      })
    }
  )
}
