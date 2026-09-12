import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

const renderers = [false, true] as const

test.describe(
  'ECS autogrow persistence @custom-nodes',
  { tag: ['@oss', '@node', '@canvas'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.canvasOps.resetView()
    })

    for (const vueNodesEnabled of renderers) {
      test(`rgthree Context Merge retains three grown inputs and links after save and full reload (${vueNodesEnabled ? 'Vue' : 'legacy'} renderer)`, async ({
        comfyPage
      }) => {
        test.setTimeout(90_000)
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
        await comfyPage.waitForAppReady()
        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.workflow.waitForWorkflowIdle()
        await comfyPage.nodeOps.clearGraph()

        const workflowName = `ecs-autogrow-${vueNodesEnabled ? 'vue' : 'legacy'}-${crypto.randomUUID()}`
        const expected = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph
          const sources = Array.from({ length: 3 }, () => {
            const source = window.LiteGraph!.createNode('Context (rgthree)')!
            graph.add(source)
            return source
          })
          const target = window.LiteGraph!.createNode(
            'Context Merge (rgthree)'
          )!
          graph.add(target)

          for (const source of sources) {
            const nextInput = target.inputs.findIndex(
              (input) => input.link == null
            )
            source.connect(0, target, nextInput)
          }

          const tuples = target.inputs
            .map((input, targetSlot) => {
              const link =
                input.link == null ? undefined : graph.links.get(input.link)
              return link
                ? [
                    String(link.origin_id),
                    link.origin_slot,
                    String(link.target_id),
                    targetSlot
                  ]
                : undefined
            })
            .filter((tuple) => tuple !== undefined)

          return {
            inputNames: target.inputs
              .filter((input) => input.link != null)
              .map((input) => input.name),
            sourceIds: sources.map((source) => String(source.id)),
            targetId: String(target.id),
            tuples
          }
        })
        await comfyPage.nextFrame()

        expect(
          expected.inputNames,
          'three distinct autogrow inputs filled'
        ).toEqual(['ctx_01', 'ctx_02', 'ctx_03'])
        const expectedTuples = expected.sourceIds.map(
          (sourceId, targetSlot) => [sourceId, 0, expected.targetId, targetSlot]
        )
        expect(
          expected.tuples,
          'each source feeds its distinct grown input'
        ).toEqual(expectedTuples)
        expect(
          new Set(expected.sourceIds).size,
          'three distinct source nodes'
        ).toBe(3)

        const saveResponsePromise = comfyPage.page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/userdata/') &&
            response.url().includes(encodeURIComponent(workflowName))
        )
        await comfyPage.menu.topbar.saveWorkflow(workflowName)
        const saveResponse = await saveResponsePromise
        expect(saveResponse.ok(), 'workflow save response is successful').toBe(
          true
        )
        await expect(comfyPage.toast.toastErrors).toHaveCount(0)

        await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
        await comfyPage.waitForAppReady()
        await openWorkflowFromSidebar(comfyPage, workflowName)

        await expect
          .poll(() =>
            comfyPage.page.evaluate((targetId) => {
              const graph = window.app!.graph
              const target = graph.nodes.find(
                (node) => String(node.id) === targetId
              )
              if (!target) return undefined
              return {
                inputNames: target.inputs
                  .filter((input) => input.link != null)
                  .map((input) => input.name),
                sourceNodes: graph.nodes
                  .filter((node) => node.type === 'Context (rgthree)')
                  .map((node) => String(node.id))
                  .sort(),
                targetType: target.type,
                tuples: target.inputs
                  .map((input, targetSlot) => {
                    const link =
                      input.link == null
                        ? undefined
                        : graph.links.get(input.link)
                    return link
                      ? [
                          String(link.origin_id),
                          link.origin_slot,
                          String(link.target_id),
                          targetSlot
                        ]
                      : undefined
                  })
                  .filter((tuple) => tuple !== undefined)
              }
            }, expected.targetId)
          )
          .toEqual({
            inputNames: expected.inputNames,
            sourceNodes: [...expected.sourceIds].sort(),
            targetType: 'Context Merge (rgthree)',
            tuples: expectedTuples
          })
      })
    }
  }
)
