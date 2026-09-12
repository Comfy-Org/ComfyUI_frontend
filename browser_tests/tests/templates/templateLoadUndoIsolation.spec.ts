import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Template load undo isolation',
  { tag: ['@slow', '@workflow'] },
  () => {
    test.describe.configure({ timeout: 45_000 })

    test('loading over a populated graph and undoing cannot restore prior IDs', async ({
      comfyPage
    }) => {
      test.slow()
      for (const vueNodesEnabled of [false, true]) {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.workflow.loadWorkflow('nodes/string_node_id')
        const priorIds = await comfyPage.page.evaluate(() =>
          window.app!.graph.nodes.map(({ id }) => String(id))
        )

        await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
        await expect(comfyPage.templates.content).toBeVisible()
        await comfyPage.page.getByRole('button', { name: 'Popular' }).click()
        const selectedTemplate = comfyPage.templates.allTemplateCards.first()
        const selectedTemplateName = (await selectedTemplate.innerText()).trim()
        expect(selectedTemplateName.length).toBeGreaterThan(0)
        await selectedTemplate.click()
        await expect(comfyPage.templates.content).toBeHidden()

        await expect
          .poll(() => comfyPage.nodeOps.getGraphNodesCount())
          .toBeGreaterThan(1)
        const loadedState = await comfyPage.page.evaluate(() => ({
          ids: window.app!.graph.nodes.map(({ id }) => String(id)),
          types: window.app!.graph.nodes.map(({ type }) => type),
          links: [...window.app!.graph.links.values()].map((link) => [
            link.origin_id,
            link.origin_slot,
            link.target_id,
            link.target_slot
          ])
        }))
        expect(loadedState.types).toEqual([
          'SaveVideo',
          'LoadImage',
          'ResolutionSelector',
          '4c314f31-ecda-4b08-ae98-faaba1bf613f',
          'MarkdownNote',
          'MarkdownNote',
          'MarkdownNote',
          'ImageScaleToTotalPixels',
          'GetImageSize'
        ])
        expect(loadedState.links).toHaveLength(5)
        expect(loadedState.ids.some((id) => priorIds.includes(id))).toBe(false)

        await comfyPage.command.executeCommand('Comfy.Undo')
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() =>
              window.app!.graph.nodes.map(({ id }) => String(id))
            )
          )
          .not.toEqual(expect.arrayContaining(priorIds))
      }
    })
  }
)
