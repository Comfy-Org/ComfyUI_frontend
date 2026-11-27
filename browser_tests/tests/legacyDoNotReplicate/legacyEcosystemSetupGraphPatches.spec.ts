import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/ecosystemSimulacraFixture'
import {
  readEcosystemSimulacra,
  seedNavigationGroups
} from '@e2e/fixtures/utils/ecosystemSimulacra'
import {
  openSecondWorkflowTab,
  removeGraphNode
} from '@e2e/fixtures/utils/legacyGraphInstancePatches'

test.describe(
  'Setup-time app.graph patches from real packs',
  { tag: '@canvas' },
  () => {
    test('Danbooru QuickGroupNavigation serialize wrapper saves its groups from another workflow', async ({
      comfyPage
    }) => {
      const groups = [{ id: 'saved-group', shortcutKey: '2' }]
      await seedNavigationGroups(comfyPage, groups)
      expect(
        (await comfyPage.workflow.getExportedWorkflow()).extra
          ?.qgn_navigation_groups
      ).toEqual(groups)

      await openSecondWorkflowTab(comfyPage)

      expect(
        (await comfyPage.workflow.getExportedWorkflow()).extra
          ?.qgn_navigation_groups
      ).toEqual(groups)
    })

    test('Danbooru QuickGroupNavigation configure wrapper restores groups imported into another workflow', async ({
      comfyPage
    }) => {
      const groups = [{ id: 'imported-group', shortcutKey: '1' }]
      await openSecondWorkflowTab(comfyPage)

      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler', {
        workflow: { extra: { qgn_navigation_groups: groups } }
      })

      expect(
        (await readEcosystemSimulacra(comfyPage)).navigation.groups
      ).toEqual(groups)
    })

    test('halxp pretty-json serialize.bind(app.graph) wrapper exports the workflow on screen', async ({
      comfyPage
    }) => {
      expect(await comfyPage.workflow.getExportedWorkflow()).toHaveProperty(
        '_prettyPrint',
        true
      )
      await openSecondWorkflowTab(comfyPage)
      const node = await comfyPage.nodeOps.addNode('KSampler')

      const exported = await comfyPage.workflow.getExportedWorkflow()

      expect.soft(exported).toHaveProperty('_prettyPrint', true)
      expect
        .soft(exported.nodes.map((entry) => String(entry.id)))
        .toEqual([String(node.id)])
    })

    test('JDCN bound onNodeAdded and onNodeRemoved wrappers see edits in another workflow', async ({
      comfyPage
    }) => {
      const first = await comfyPage.nodeOps.addNode('KSampler')
      await removeGraphNode(comfyPage, first)
      const initial = await readEcosystemSimulacra(comfyPage)
      expect(initial.added).toContain(String(first.id))
      expect(initial.removed).toContain(String(first.id))

      await openSecondWorkflowTab(comfyPage)
      const before = await readEcosystemSimulacra(comfyPage)
      const second = await comfyPage.nodeOps.addNode('KSampler')
      await removeGraphNode(comfyPage, second)

      const result = await readEcosystemSimulacra(comfyPage)
      expect
        .soft(result.added.slice(before.added.length))
        .toEqual([String(second.id)])
      expect
        .soft(result.removed.slice(before.removed.length))
        .toEqual([String(second.id)])
    })
  }
)
