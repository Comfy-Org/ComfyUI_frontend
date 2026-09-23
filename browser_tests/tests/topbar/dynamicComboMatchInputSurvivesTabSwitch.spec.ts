import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

// https://github.com/Comfy-Org/ComfyUI_frontend/issues/18388
//
// "Resize Image/Mask" only exposes its "match" input after switching
// `resize_type` (a DynamicCombo) to the "match size" option. Switching
// workflow tabs reconstructs the node fresh from its definition - picking
// the default option again - and then replays the saved combo value, the
// same reload path a workflow reopen or tab switch takes in production.
const RESIZE_NODE_TITLE = 'Resize Image/Mask'
const RESIZE_NODE_POSITION = { x: 600, y: 300 }
const BASE_SOURCE_POSITION = { x: 200, y: 200 }
const MATCH_SOURCE_POSITION = { x: 200, y: 500 }

test.describe(
  'DynamicCombo revealed input link survives a workflow tab switch (#18388)',
  { tag: ['@vue-nodes', '@slow'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('the "match" input keeps its link after switching tabs and back', async ({
      comfyPage
    }) => {
      // Three added nodes plus two real drag-connects exceed the project's
      // default 15s budget. The CI video-walkthrough job
      // (playwright-video-new-tests) reruns new specs like this one with
      // RECORD_VIDEO=true and SLOW_MO=250, which adds ~250ms per Playwright
      // action on top of video-capture overhead. The first 60s bump still
      // timed out there, landing at ~64s actual, so this raises the budget
      // to ~2x that observed runtime.
      test.setTimeout(120000)
      const { searchBoxV2, nodeOps, vueNodes, workflow } = comfyPage

      const getLinkOriginIds = async (resizeNodeId: string) => {
        const resizeNode = await nodeOps.getNodeRefById(resizeNodeId)
        const baseInputIndex = await resizeNode.getInputIndexByName('input')
        const matchInputIndex =
          await resizeNode.getInputIndexByName('resize_type.match')
        const baseLink = await (
          await resizeNode.getInput(baseInputIndex)
        ).getLink()
        const matchLink = await (
          await resizeNode.getInput(matchInputIndex)
        ).getLink()
        return {
          base: baseLink ? String(baseLink.origin_id) : null,
          match: matchLink ? String(matchLink.origin_id) : null
        }
      }

      const { resizeNodeId, baseSourceId, matchSourceId } =
        await test.step('reveal the match input and connect two distinct image sources', async () => {
          // A blank tab, so the double-click that opens the search box lands
          // on the canvas and not on a default-graph node.
          await workflow.newBlankWorkflow()

          const resizeNodeId = await searchBoxV2.addNodeAndGetId(
            RESIZE_NODE_TITLE,
            { position: RESIZE_NODE_POSITION }
          )
          await vueNodes.selectComboOption(
            RESIZE_NODE_TITLE,
            'resize_type',
            'match size'
          )

          const baseSourceId = await searchBoxV2.addNodeAndGetId('Load Image', {
            position: BASE_SOURCE_POSITION
          })
          const matchSourceId = await searchBoxV2.addNodeAndGetId(
            'Load Image',
            { position: MATCH_SOURCE_POSITION }
          )

          const resizeNode = await nodeOps.getNodeRefById(resizeNodeId)
          const baseSource = await nodeOps.getNodeRefById(baseSourceId)
          const matchSource = await nodeOps.getNodeRefById(matchSourceId)

          const baseInputIndex = await resizeNode.getInputIndexByName('input')
          await baseSource.connectOutput(0, resizeNode, baseInputIndex)

          const matchInputIndex =
            await resizeNode.getInputIndexByName('resize_type.match')
          await matchSource.connectOutput(0, resizeNode, matchInputIndex)

          return { resizeNodeId, baseSourceId, matchSourceId }
        })

      await test.step('both links are connected before switching tabs', async () => {
        await expect
          .poll(() => getLinkOriginIds(resizeNodeId))
          .toEqual({ base: baseSourceId, match: matchSourceId })
      })

      await test.step('switch to another tab and back', async () => {
        await workflow.openNewTabThenReturn()
      })

      await test.step('both links, and the selected combo option, survive the reload', async () => {
        await expect
          .poll(() => getLinkOriginIds(resizeNodeId))
          .toEqual({ base: baseSourceId, match: matchSourceId })

        const resizeNode = await nodeOps.getNodeRefById(resizeNodeId)
        const resizeTypeWidget = await resizeNode.getWidgetByName('resize_type')
        await expect.poll(() => resizeTypeWidget.getValue()).toBe('match size')
      })
    })
  }
)
