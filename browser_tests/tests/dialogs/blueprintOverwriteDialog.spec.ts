import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Blueprint overwrite dialog',
  { tag: ['@ui', '@subgraph'] },
  () => {
    test('warns before overwriting, and honors "do not ask again"', async ({
      comfyPage
    }) => {
      const blueprintName = `test-blueprint-overwrite-${Date.now()}`
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.WarnBlueprintOverwrite',
        true
      )

      const tab = comfyPage.menu.nodeLibraryTabV2

      await test.step('Publish a basic subgraph', async () => {
        const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
        await comfyPage.contextMenu.openForVueNode(ksampler.header)
        await comfyPage.contextMenu.clickMenuItemExact('Convert to Subgraph')
        await comfyPage.subgraph.publishSubgraph(blueprintName)

        await tab.open()
        await tab.getFolder('My Blueprints').click()
        await tab.getFolder('User').click()
      })

      const steps = comfyPage.vueNodes.getWidgetByName('KSampler', 'steps')

      await test.step('Edit the published subgraph', async () => {
        const blueprintNode = tab.getNode(blueprintName)
        await expect(
          blueprintNode,
          'blueprint visible in library'
        ).toBeVisible()
        await blueprintNode.getByRole('button', { name: 'Edit' }).click()
        await steps.waitFor({ state: 'visible' })
      })

      const confirmDialog = comfyPage.confirmDialog.root
      const { incrementButton } =
        comfyPage.vueNodes.getInputNumberControls(steps)
      const dirtyGraphAndSave = async () => {
        await incrementButton.click()
        await comfyPage.page.keyboard.press('Control+s')
      }

      await test.step('No dialog: user prompted on publish', async () => {
        await dirtyGraphAndSave()
        await comfyPage.nextFrame()
        await expect(confirmDialog).toBeHidden()
      })

      await test.step('Should show dialog', async () => {
        await comfyPage.subgraph.setSaveUnpromptedOnActiveBlueprint()
        await dirtyGraphAndSave()
        const { noWarnOverwriteToggle } = comfyPage.confirmDialog
        await expect(noWarnOverwriteToggle).toBeVisible()

        await test.step('Disable overwrite warning', async () => {
          await noWarnOverwriteToggle.check()
          await expect(confirmDialog.getByText(/Re-enable in/i)).toBeVisible()
          await comfyPage.confirmDialog.click('overwrite')
        })
      })

      await test.step('No dialog: disabled by setting', async () => {
        await comfyPage.subgraph.setSaveUnpromptedOnActiveBlueprint()
        await dirtyGraphAndSave()
        await comfyPage.nextFrame()
        await expect(confirmDialog).toBeHidden()
      })
    })
  }
)
