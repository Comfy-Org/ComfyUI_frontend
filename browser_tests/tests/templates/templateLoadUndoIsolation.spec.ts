import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Template load undo isolation',
  { tag: ['@slow', '@workflow'] },
  () => {
    test('loading over a populated graph and undoing cannot restore prior IDs', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/string_node_id')
      const priorIds = await comfyPage.page.evaluate(() =>
        window.app!.graph.nodes.map(({ id }) => String(id))
      )

      await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
      await expect(comfyPage.templates.content).toBeVisible()
      await comfyPage.page.getByRole('button', { name: 'Popular' }).click()
      await comfyPage.templates.allTemplateCards.first().click()
      await expect(comfyPage.templates.content).toBeHidden()

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBeGreaterThan(1)
      const loadedState = await comfyPage.page.evaluate(() => ({
        ids: window.app!.graph.nodes.map(({ id }) => String(id)),
        linkCount: window.app!.graph.links.size
      }))
      expect(loadedState.linkCount).toBeGreaterThan(0)
      expect(loadedState.ids.some((id) => priorIds.includes(id))).toBe(false)

      await comfyPage.command.executeCommand('Comfy.Undo')
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() =>
            window.app!.graph.nodes.map(({ id }) => String(id))
          )
        )
        .not.toEqual(expect.arrayContaining(priorIds))
    })
  }
)
