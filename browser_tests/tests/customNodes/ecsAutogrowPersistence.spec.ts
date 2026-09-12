import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { packPersistenceTest as test } from '@e2e/fixtures/customNode/packPersistenceFixture'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

test.describe(
  'ECS autogrow persistence @custom-nodes',
  { tag: ['@oss', '@node', '@canvas'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    for (const renderer of [
      { name: 'legacy', tags: [] },
      { name: 'Vue', tags: ['@vue-nodes'] }
    ]) {
      test(
        `rgthree Context Merge retains three grown inputs and links after save and full reload (${renderer.name} renderer)`,
        { tag: renderer.tags },
        async ({ comfyPage, packPersistence, savedWorkflows }) => {
          test.setTimeout(90_000)
          await comfyPage.workflow.reloadAndWaitForApp()
          await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
          await comfyPage.workflow.waitForWorkflowIdle()
          await comfyPage.nodeOps.clearGraph()

          const workflowName = `ecs-autogrow-${renderer.name.toLowerCase()}-${crypto.randomUUID()}`
          savedWorkflows.track(workflowName)

          const expected =
            await test.step('grow and connect three inputs', async () => {
              const graphState = await comfyPage.page.evaluate(() => {
                const graph = window.app!.graph
                const sources = Array.from({ length: 3 }, () => {
                  const source =
                    window.LiteGraph!.createNode('Context (rgthree)')!
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

                return {
                  inputNames: target.inputs
                    .filter((input) => input.link != null)
                    .map((input) => input.name),
                  sourceIds: sources.map((source) => String(source.id)),
                  targetId: String(target.id)
                }
              })
              await comfyPage.nextFrame()
              const tuples = await packPersistence.projectInputLinks(
                graphState.targetId
              )

              expect(graphState.inputNames).toEqual([
                'ctx_01',
                'ctx_02',
                'ctx_03'
              ])
              expect(new Set(graphState.sourceIds).size).toBe(3)
              return { ...graphState, tuples }
            })

          const expectedTuples = expected.sourceIds.map(
            (sourceId, targetSlot) => [
              sourceId,
              0,
              expected.targetId,
              targetSlot
            ]
          )

          expect(expected.tuples).toEqual(expectedTuples)

          await test.step('save workflow', async () => {
            const saveResponsePromise = comfyPage.page.waitForResponse(
              (response) =>
                response.request().method() === 'POST' &&
                response.url().includes('/userdata/') &&
                response.url().includes(encodeURIComponent(workflowName))
            )
            await comfyPage.menu.topbar.saveWorkflow(workflowName)
            expect((await saveResponsePromise).ok()).toBe(true)
            await expect(comfyPage.toast.toastErrors).toHaveCount(0)
          })

          await test.step('reload and verify persisted links', async () => {
            await comfyPage.workflow.reloadAndWaitForApp()
            await openWorkflowFromSidebar(comfyPage, workflowName)
            await expect
              .poll(async () => ({
                graph: await comfyPage.page.evaluate((targetId) => {
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
                    targetType: target.type
                  }
                }, expected.targetId),
                tuples: await packPersistence.projectInputLinks(
                  expected.targetId
                )
              }))
              .toEqual({
                graph: {
                  inputNames: expected.inputNames,
                  sourceNodes: [...expected.sourceIds].sort(),
                  targetType: 'Context Merge (rgthree)'
                },
                tuples: expectedTuples
              })
          })
        }
      )
    }
  }
)
