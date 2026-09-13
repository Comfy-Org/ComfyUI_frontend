import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

/**
 * Group nodes are a deprecated feature. Workflows that still contain group nodes
 * are auto-converted to subgraphs on load (with accepted lossiness).
 */
test.describe('Group node migration', { tag: '@node' }, () => {
  test('Auto-converts a loaded group node into a subgraph', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('groupnodes/group_node_v1.3.3')

    const state = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph
      return {
        groupNodeInstances: graph.nodes.filter((n) =>
          n.type.startsWith('workflow>')
        ).length,
        subgraphCount: graph.subgraphs.size,
        hasGroupNodesExtra: !!graph.extra.groupNodes
      }
    })

    expect(state.groupNodeInstances).toBe(0)
    expect(state.subgraphCount).toBe(1)
    expect(state.hasGroupNodesExtra).toBe(false)
  })

  // QA found this broken on 2026-09-10 while running the 1.54 test plan:
  // converting a v1.3.3 group node misaligns widget values by two positions, so
  // denoise receives 'euler' and filename_prefix receives 'normal'. Saving then
  // writes the wrong values back, silently corrupting the workflow. Pinned with
  // test.fail() so the fix flips this to passing.
  test('Preserves group node widget values through subgraph conversion', async ({
    comfyPage
  }) => {
    test.fail()
    await comfyPage.workflow.loadWorkflow('groupnodes/group_node_v1.3.3')

    const interiorNodes = await comfyPage.page.evaluate(() =>
      [...window.app!.graph.subgraphs.values()].flatMap((subgraph) =>
        subgraph.nodes.map((node) => ({
          type: node.type,
          widgets: Object.fromEntries(
            (node.widgets ?? []).map((widget) => [widget.name, widget.value])
          )
        }))
      )
    )

    const ksampler = interiorNodes.find((node) => node.type === 'KSampler')
    expect(
      ksampler,
      'converted subgraph should contain a KSampler'
    ).toBeDefined()
    expect(ksampler!.widgets).toMatchObject({
      seed: 156680208700286,
      steps: 20,
      cfg: 8,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: 1
    })

    const saveImage = interiorNodes.find((node) => node.type === 'SaveImage')
    expect(
      saveImage,
      'converted subgraph should contain a SaveImage'
    ).toBeDefined()
    expect(saveImage!.widgets).toMatchObject({ filename_prefix: 'ComfyUI' })
  })

  test(
    'Loads a legacy ("/") separator group node without error and converts it',
    { tag: ['@vue-nodes'] },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('groupnodes/legacy_group_node')

      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeHidden()
      await expect(
        comfyPage.vueNodes.getNodeByTitle('New Subgraph')
      ).toBeVisible()

      await comfyPage.vueNodes.enterSubgraph()
      await expect(comfyPage.vueNodes.getNodeByTitle('')).toHaveCount(2)
    }
  )
})
