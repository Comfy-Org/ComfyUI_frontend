import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { packPersistenceTest as test } from '@e2e/fixtures/customNode/packPersistenceFixture'
import {
  customNodeSuiteSettings,
  hasInstalledPack
} from '@e2e/fixtures/utils/customNodeSuite'

test.use({ initialSettings: customNodeSuiteSettings })

test.describe(
  'dynamic input collapse execution @custom-nodes',
  { tag: ['@oss', '@node', '@canvas'] },
  () => {
    if (!hasInstalledPack('ComfyUI-Impact-Pack')) return
    for (const vueNodesEnabled of [false, true])
      test(`Impact dynamic inputs stay connected through collapse (${vueNodesEnabled ? 'Vue' : 'legacy'} renderer)`, async ({
        comfyPage,
        packPersistence
      }, testInfo) => {
        test.setTimeout(90_000)
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.nodeOps.clearGraph()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() =>
              window.app!.extensions.map((extension) => extension.name)
            )
          )
          .toContain('Comfy.Impack')

        const ids = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph
          const first = window.LiteGraph!.createNode('EmptyImage')!
          const second = window.LiteGraph!.createNode('EmptyImage')!
          const list = window.LiteGraph!.createNode('ImpactMakeImageList')!
          const preview = window.LiteGraph!.createNode('PreviewImage')!
          first.widgets!.find((widget) => widget.name === 'color')!.value =
            0xff0000
          second.widgets!.find((widget) => widget.name === 'color')!.value =
            0x0000ff
          graph.add(first)
          graph.add(second)
          graph.add(list)
          graph.add(preview)
          first.pos = [50, 80]
          second.pos = [50, 360]
          list.pos = [600, 220]
          preview.pos = [1_050, 220]
          list.connect(0, preview, 0)
          return {
            first: String(first.id),
            second: String(second.id),
            list: String(list.id),
            preview: String(preview.id)
          }
        })
        await comfyPage.nextFrame()

        if (vueNodesEnabled) await comfyPage.vueNodes.waitForNodes(4)
        const first = await comfyPage.nodeOps.getNodeRefById(ids.first)
        const second = await comfyPage.nodeOps.getNodeRefById(ids.second)
        const list = await comfyPage.nodeOps.getNodeRefById(ids.list)
        await first.connectOutput(0, list, 0)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (id) =>
                window.app!.graph.nodes.find((node) => String(node.id) === id)!
                  .inputs.length,
              ids.list
            )
          )
          .toBe(2)
        await second.connectOutput(0, list, 1)
        await comfyPage.nextFrame()

        const expectedLinks = [
          [ids.first, 0, ids.list, 0],
          [ids.second, 0, ids.list, 1]
        ]
        const inputLinks = () => packPersistence.projectInputLinks(ids.list)
        await expect.poll(inputLinks).toEqual(expectedLinks)

        await list.click('title')
        await comfyPage.keyboard.press('Alt+KeyC')
        await expect.poll(() => list.isCollapsed()).toBe(true)
        await expect.poll(inputLinks).toEqual(expectedLinks)
        await comfyPage.keyboard.press('Alt+KeyC')
        await expect.poll(() => list.isCollapsed()).toBe(false)
        await expect.poll(inputLinks).toEqual(expectedLinks)

        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (targetId) =>
                [...window.app!.canvas.renderedPaths].flatMap((path) =>
                  'origin_id' in path &&
                  'origin_slot' in path &&
                  'target_id' in path &&
                  'target_slot' in path &&
                  String(path.target_id) === targetId
                    ? [
                        [
                          String(path.origin_id),
                          path.origin_slot,
                          String(path.target_id),
                          path.target_slot
                        ]
                      ]
                    : []
                ),
              ids.list
            )
          )
          .toEqual(expectedLinks)

        const result = await packPersistence.target.runWorkflow(
          comfyPage.page,
          {
            expectedNodeIds: [ids.first, ids.second, ids.list, ids.preview],
            timeoutMs: 60_000
          }
        )
        expect(result.outcome, result.clientError).toBe('PASS')
        expect(result.executedNodes).toEqual(
          expect.arrayContaining([ids.first, ids.second, ids.list, ids.preview])
        )
        expect(result.outputsByNode[ids.preview]).toBeDefined()
        const screenshotPath = testInfo.outputPath('dynamic-input-output.png')
        await comfyPage.page.screenshot({ path: screenshotPath })
        await testInfo.attach('dynamic input output', {
          path: screenshotPath,
          contentType: 'image/png'
        })
      })
  }
)
