import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  customNodesManifest,
  loadManifest
} from '@e2e/fixtures/customNode/manifest'
import { customNodeSuiteSettings } from '@e2e/fixtures/utils/customNodeSuite'

test.use({ initialSettings: customNodeSuiteSettings })

test.describe(
  'ECS migration custom-node scenarios',
  { tag: '@custom-nodes' },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.deleteWorkflow('ecs-prompt-combinator')
      await comfyPage.workflow.deleteWorkflow('ecs-vhs-video-combine')
    })

    test('Prompt Combinator multiline entries persist after reload', async ({
      comfyPage
    }) => {
      // oxlint-disable-next-line playwright/no-skipped-test -- pack availability differs by manifest shard
      test.skip(
        customNodesManifest() !== 'cloud' ||
          !loadManifest().some(
            ({ pack }) => pack === 'ComfyUI-Prompt-Combinator'
          ),
        'ComfyUI-Prompt-Combinator is not installed in this manifest shard'
      )
      test.setTimeout(60_000)
      await comfyPage.nodeOps.clearGraph()

      const created = await comfyPage.page.evaluate(() => {
        const node = window.LiteGraph!.createNode('PromptCombinator')
        if (!node) throw new Error('PromptCombinator did not instantiate')
        node.pos = [300, 200]
        window.app!.graph.add(node)
        const widget = node.widgets?.find(({ name }) => name === 'input_list_1')
        if (!widget) throw new Error('input_list_1 widget is unavailable')
        widget.value = `third@third prompt
first@first prompt
second@second prompt`
        return {
          id: node.id,
          value: widget.value,
          widgets: node.widgets?.map(({ name }) => name) ?? []
        }
      })

      expect(created.widgets).toContain('input_list_1')
      expect(created.value).toBe(
        `third@third prompt
first@first prompt
second@second prompt`
      )
      await comfyPage.menu.topbar.saveWorkflow('ecs-prompt-combinator')
      await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
      await comfyPage.waitForAppReady()

      await expect.poll(() =>
        comfyPage.page.evaluate((id) => {
          const node = window.app!.graph.getNodeById(id)
          return node?.widgets?.find(({ name }) => name === 'input_list_1')
            ?.value
        }, created.id)
      ).toBe(`third@third prompt
first@first prompt
second@second prompt`)
    })

    test('VHS Load Video connects to Video Combine and persists widgets', async ({
      comfyPage
    }) => {
      // oxlint-disable-next-line playwright/no-skipped-test -- pack availability differs by manifest shard
      test.skip(
        !loadManifest().some(({ pack }) =>
          ['ComfyUI-VideoHelperSuite', 'comfyui-videohelpersuite'].includes(
            pack
          )
        ),
        'Video Helper Suite is not installed in this manifest shard'
      )
      test.setTimeout(60_000)
      await comfyPage.nodeOps.clearGraph()

      const created = await comfyPage.page.evaluate(() => {
        const load = window.LiteGraph!.createNode('VHS_LoadVideo')
        const combine = window.LiteGraph!.createNode('VHS_VideoCombine')
        if (!load || !combine) throw new Error('VHS nodes did not instantiate')
        load.pos = [200, 200]
        combine.pos = [650, 200]
        window.app!.graph.add(load)
        window.app!.graph.add(combine)
        load.connect(0, combine, 0)
        const frameRate = combine.widgets?.find(
          ({ name }) => name === 'frame_rate'
        )
        if (!frameRate) throw new Error('frame_rate widget is unavailable')
        frameRate.value = 12
        return {
          loadId: load.id,
          combineId: combine.id,
          widgetNames: combine.widgets?.map(({ name }) => name) ?? [],
          frameRate: frameRate.value,
          linkCount: Object.keys(window.app!.graph.links).length
        }
      })

      expect(created.widgetNames).toContain('frame_rate')
      expect(created.frameRate).toBe(12)
      expect(created.linkCount).toBe(1)
      await comfyPage.menu.topbar.saveWorkflow('ecs-vhs-video-combine')
      await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
      await comfyPage.waitForAppReady()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(({ combineId, loadId }) => {
            const graph = window.app!.graph
            const combine = graph.getNodeById(combineId)
            const link = Object.values(graph.links)[0]
            return {
              nodesPresent: Boolean(graph.getNodeById(loadId) && combine),
              frameRate: combine?.widgets?.find(
                ({ name }) => name === 'frame_rate'
              )?.value,
              link: link && {
                originId: link.origin_id,
                originSlot: link.origin_slot,
                targetId: link.target_id,
                targetSlot: link.target_slot
              }
            }
          }, created)
        )
        .toEqual({
          nodesPresent: true,
          frameRate: 12,
          link: {
            originId: created.loadId,
            originSlot: 0,
            targetId: created.combineId,
            targetSlot: 0
          }
        })
    })
  }
)
