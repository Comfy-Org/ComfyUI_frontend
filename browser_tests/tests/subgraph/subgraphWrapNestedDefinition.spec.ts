import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { expect } from '@playwright/test'

test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })

test.describe(
  'Wrapping a subgraph host that owns nested definitions',
  { tag: ['@subgraph', '@slow'] },
  () => {
    const WRAPPED_SELECTION = ['subgraph 2', 'VAE Decode', 'Save Image']

    const NESTED_DEFINITIONS_INTACT = [
      { name: 'subgraph 2', nodes: 3, links: 7 },
      { name: 'subgraph 3', nodes: 3, links: 6 }
    ]

    // The wrapper's 4th link is the boundary link feeding Save Image's
    // filename_prefix widget, which conversion promotes to a wrapper input.
    const NESTED_DEFINITIONS_AFTER_WRAP = [
      { name: 'New Subgraph', nodes: 3, links: 4 },
      ...NESTED_DEFINITIONS_INTACT
    ]

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/nested-subgraph')
    })

    test('keeps the wrapped and nested definitions populated', async ({
      comfyPage
    }) => {
      await expect
        .poll(() => comfyPage.subgraph.getDefinitionInventory())
        .toEqual(NESTED_DEFINITIONS_INTACT)

      await test.step('Wrap the subgraph host together with its siblings', async () => {
        await comfyPage.nodeOps.selectNodes(WRAPPED_SELECTION)
        expect(
          [...(await comfyPage.nodeOps.getSelectedNodeIds())].sort(),
          'all three nodes must be selected, or the conversion under test is not the one being asserted'
        ).toEqual(['10', '8', '9'])

        const host = await comfyPage.nodeOps.getNodeRefById('10')
        await host.convertToSubgraph()
      })

      await expect
        .poll(() => comfyPage.subgraph.getDefinitionInventory())
        .toEqual(NESTED_DEFINITIONS_AFTER_WRAP)
    })

    test('keeps the nested definitions populated in the saved workflow', async ({
      comfyPage
    }) => {
      await test.step('Wrap the subgraph host together with its siblings', async () => {
        await comfyPage.nodeOps.selectNodes(WRAPPED_SELECTION)
        const host = await comfyPage.nodeOps.getNodeRefById('10')
        await host.convertToSubgraph()
      })

      await comfyPage.subgraph.serializeAndReload()

      await expect
        .poll(() => comfyPage.subgraph.getSerializedDefinitionInventory())
        .toEqual(NESTED_DEFINITIONS_AFTER_WRAP)
    })

    test(
      'still renders the nested interior after wrapping',
      { tag: ['@vue-nodes'] },
      async ({ comfyPage }) => {
        await test.step('Wrap the subgraph host together with its siblings', async () => {
          await comfyPage.nodeOps.selectNodes(WRAPPED_SELECTION)
          const host = await comfyPage.nodeOps.getNodeRefById('10')
          await host.convertToSubgraph()
        })

        await test.step('Descend through the wrapper into the deepest nested subgraph', async () => {
          await comfyPage.subgraph.descendSubgraphs(3)
        })

        await test.step('Assert the deepest interior still renders its three nodes', async () => {
          await expect(comfyPage.vueNodes.nodes).toHaveCount(3)
          await expect(
            comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
          ).toBeVisible()
          await expect(
            comfyPage.vueNodes.getNodeByTitle('Empty Latent Image')
          ).toBeVisible()
          await expect(
            comfyPage.vueNodes.getNodeByTitle('CLIP Text Encode (Prompt)')
          ).toBeVisible()
          await comfyPage.attachScreenshot(
            'nested-subgraph-interior-after-wrap',
            { runInCI: true }
          )
        })
      }
    )
  }
)
