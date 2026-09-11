/* oxlint-disable playwright/no-skipped-test, playwright/expect-expect -- QA rows stay visible as skipped tests when their packs are absent from the manifest. */
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
    test('rgthree Fast Muter toggles target modes and persists its renamed label', async () => {
      test.skip(true, 'rgthree is not present in customNodeManifest.cloud.json')
    })

    test('rgthree Fast Bypasser toggles target bypass modes', async () => {
      test.skip(true, 'rgthree is not present in customNodeManifest.cloud.json')
    })

    test('rgthree boundary link-control disconnects a link', async () => {
      test.skip(
        true,
        'rgthree is not present in customNodeManifest.cloud.json; known gap: https://github.com/Comfy-Org/ComfyUI_frontend/issues/15501'
      )
    })

    test('Prompt Combinator reordered entries persist after reload', async ({
      comfyPage
    }) => {
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
        if (!node) return null
        node.pos = [300, 200]
        window.app!.graph.add(node)
        const widget = node.widgets?.find(({ name }) => name === 'input_list_1')
        if (!widget) return null
        widget.value =
          'third@third prompt\nfirst@first prompt\nsecond@second prompt'
        return {
          id: node.id,
          value: widget.value,
          widgets: node.widgets?.map(({ name }) => name) ?? []
        }
      })

      expect(created, 'PromptCombinator did not instantiate').not.toBeNull()
      expect(created!.widgets).toContain('input_list_1')
      expect(created!.value).toBe(
        'third@third prompt\nfirst@first prompt\nsecond@second prompt'
      )
      await comfyPage.menu.topbar.saveWorkflow('ecs-prompt-combinator')
      await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
      await comfyPage.waitForAppReady()

      await expect
        .poll(() =>
          comfyPage.page.evaluate((id) => {
            const node = window.app!.graph.getNodeById(id)
            return node?.widgets?.find(({ name }) => name === 'input_list_1')
              ?.value
          }, created!.id)
        )
        .toBe('third@third prompt\nfirst@first prompt\nsecond@second prompt')
    })

    test('rgthree Fix-in-place keeps the node and its links intact', async () => {
      test.skip(true, 'rgthree is not present in customNodeManifest.cloud.json')
    })

    test('easy-use seed control persists its changed seed', async () => {
      test.skip(
        true,
        'easy-use is not present in customNodeManifest.cloud.json; known gap: https://github.com/Comfy-Org/ComfyUI_frontend/issues/15579'
      )
    })

    test('VHS Load Video connects to Video Combine and persists widgets', async ({
      comfyPage
    }) => {
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
        if (!load || !combine) return null
        load.pos = [200, 200]
        combine.pos = [650, 200]
        window.app!.graph.add(load)
        window.app!.graph.add(combine)
        load.connect(0, combine, 0)
        const frameRate = combine.widgets?.find(
          ({ name }) => name === 'frame_rate'
        )
        if (!frameRate) return null
        frameRate.value = 12
        return {
          loadId: load.id,
          combineId: combine.id,
          widgetNames: combine.widgets?.map(({ name }) => name) ?? [],
          frameRate: frameRate.value,
          linkCount: Object.keys(window.app!.graph.links).length
        }
      })

      expect(
        created,
        'VHS nodes or frame_rate widget did not instantiate'
      ).not.toBeNull()
      expect(created!.widgetNames).toContain('frame_rate')
      expect(created!.frameRate).toBe(12)
      expect(created!.linkCount).toBe(1)
      await comfyPage.menu.topbar.saveWorkflow('ecs-vhs-video-combine')
      await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
      await comfyPage.waitForAppReady()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(({ combineId, loadId }) => {
            const graph = window.app!.graph
            const combine = graph.getNodeById(combineId)
            return {
              nodesPresent: Boolean(graph.getNodeById(loadId) && combine),
              frameRate: combine?.widgets?.find(
                ({ name }) => name === 'frame_rate'
              )?.value,
              linkCount: Object.keys(graph.links).length
            }
          }, created!)
        )
        .toEqual({ nodesPresent: true, frameRate: 12, linkCount: 1 })
    })
  }
)
