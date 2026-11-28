import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  MAGENTA,
  PACK_RENDERERS,
  PACK_TAGS,
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
import {
  test,
  paintKnobMagenta,
  nodeSize,
  widgetValues,
  clickTitleButton,
  titleButtonIconPixels
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.mxToolkit'

const SLIDER_TRACK_LEFT = 10
const SLIDER_TRACK_RIGHT_INSET = 60

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
        comfyPage,
        mxWorkflow
      }) => {
        await paintKnobMagenta(comfyPage)
        const id = await mxWorkflow('mxSlider')
        const track = SLIDER_TRACK_LEFT
        const trackWidth = 210 - SLIDER_TRACK_RIGHT_INSET - SLIDER_TRACK_LEFT
        expect((await nodeSize(comfyPage, id))[0]).toBe(210)
        expect(await widgetValues(comfyPage, id)).toMatchObject({ Xi: 20 })

        await comfyPage.canvasOps.dragAndDrop(
          await nodeLocalPoint(comfyPage, id, [track + trackWidth * 0.2, 14]),
          await nodeLocalPoint(comfyPage, id, [track + trackWidth * 0.8, 14])
        )

        await expect
          .poll(() => widgetValues(comfyPage, id), {
            message: 'Xi/Xf committed by onMouseUp'
          })
          .toMatchObject({ Xi: 80, Xf: 80 })
        await comfyPage.canvasOps.moveMouseToEmptyArea()
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
        comfyPage,
        mxWorkflow
      }) => {
        await paintKnobMagenta(comfyPage)
        const id = await mxWorkflow('mxSlider2D')
        expect(await nodeSize(comfyPage, id)).toEqual([210, 160])
        expect(await widgetValues(comfyPage, id)).toMatchObject({
          Xi: 512,
          Yi: 512
        })
        const area = 140
        const target = [10 + area * 0.125, 10 + area * 0.125] as const

        await comfyPage.canvasOps.dragAndDrop(
          await nodeLocalPoint(comfyPage, id, [80, 80]),
          await nodeLocalPoint(comfyPage, id, target)
        )

        await expect
          .poll(() => widgetValues(comfyPage, id), {
            message: 'Xi/Yi committed by onMouseUp'
          })
          .toMatchObject({ Xi: 128, Xf: 128, Yi: 896, Yf: 896 })
        await comfyPage.canvasOps.moveMouseToEmptyArea()
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
        comfyPage,
        mxWorkflow
      }) => {
        await countQueueCalls(comfyPage)
        const id = await mxWorkflow('mxSeed')
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
        comfyPage,
        mxWorkflow
      }) => {
        await countQueueCalls(comfyPage)
        const id = await mxWorkflow('mxStop')

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
        comfyPage,
        mxWorkflow
      }) => {
        const id = await mxWorkflow('mxReroute')
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
