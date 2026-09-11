import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'DynamicGroup',
  { tag: ['@widget', '@vue-nodes', '@oss'] },
  () => {
    test.use({ initialSettings: { 'Comfy.VueNodes.Enabled': true } })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('inputs/dynamic_group')
      await comfyPage.vueNodes.waitForNodes(2)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.canvasOps.resetView()
    })

    test('executes an empty group as an empty list', async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Node With Dynamic Group')
      await expect(node.getByRole('button', { name: 'Add LoRA' })).toBeVisible()
      await expect(
        node.getByRole('button', { name: /Remove LoRA/ })
      ).toHaveCount(0)

      await comfyPage.command.executeCommand('Comfy.QueuePrompt')

      await expect(
        comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
      ).toHaveValue('{"before": "first", "loras": [], "after": "last"}')
    })

    test('preserves edited rows through removal, save, reopen and execution', async ({
      comfyPage
    }) => {
      test.slow()
      const node = comfyPage.vueNodes.getNodeByTitle('Node With Dynamic Group')
      await node.getByLabel('before', { exact: true }).fill('head')
      await node.getByLabel('after', { exact: true }).fill('tail')
      await node.getByRole('button', { name: 'Add LoRA' }).click()
      await node.getByRole('button', { name: 'Add LoRA' }).click()
      await node.getByRole('button', { name: 'Add LoRA' }).click()
      await expect(
        node.getByRole('button', { name: 'Add LoRA' })
      ).toBeDisabled()
      await expect(
        node.getByRole('combobox', { name: 'lora_name', exact: true })
      ).toHaveCount(3)
      await node
        .getByRole('combobox', { name: 'lora_name', exact: true })
        .nth(1)
        .click()
      await comfyPage.page
        .getByRole('option', { name: 'B.safetensors', exact: true })
        .click()
      await node
        .getByRole('combobox', { name: 'lora_name', exact: true })
        .nth(2)
        .click()
      await comfyPage.page
        .getByRole('option', { name: 'C.safetensors', exact: true })
        .click()
      const strength = comfyPage.vueNodes.getInputNumberControls(
        node.getByLabel('loras.2.strength', { exact: true })
      ).input
      await strength.fill('0.5')
      await strength.blur()
      await node.getByLabel('loras.2.enabled', { exact: true }).click()
      await node
        .getByRole('button', { name: 'Remove LoRA #2', exact: true })
        .click()
      await comfyPage.command.executeCommand('Comfy.Undo')
      await expect(
        node.getByRole('combobox', { name: 'lora_name', exact: true })
      ).toHaveText(['A.safetensors', 'B.safetensors', 'C.safetensors'])
      await comfyPage.command.executeCommand('Comfy.Redo')
      await expect(
        node.getByRole('combobox', { name: 'lora_name', exact: true }).nth(1)
      ).toHaveText('C.safetensors')
      await expect(
        node.getByLabel('loras.1.enabled', { exact: true })
      ).not.toBeChecked()
      await expect(node.getByRole('button', { name: 'Add LoRA' })).toBeEnabled()

      await comfyPage.menu.topbar.saveWorkflow('dynamic-group-rows')
      await comfyPage.menu.topbar.closeWorkflowTab('dynamic-group-rows')
      await comfyPage.page.keyboard.press('w')
      await comfyPage.menu.workflowsTab
        .getPersistedItem('dynamic-group-rows')
        .dblclick()
      await expect
        .poll(() => comfyPage.workflow.getActiveWorkflowPath())
        .toContain('dynamic-group-rows')
      await comfyPage.vueNodes.waitForNodes(2)
      await comfyPage.menu.workflowsTab.close()
      await expect(node.getByLabel('before', { exact: true })).toHaveValue(
        'head'
      )
      await expect(node.getByLabel('after', { exact: true })).toHaveValue(
        'tail'
      )
      await expect(
        node.getByRole('combobox', { name: 'lora_name', exact: true })
      ).toHaveText(['A.safetensors', 'C.safetensors'])
      await expect(
        node.getByLabel('loras.1.enabled', { exact: true })
      ).not.toBeChecked()

      await comfyPage.command.executeCommand('Comfy.QueuePrompt')

      await expect(
        comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
      ).toHaveValue(
        '{"before": "head", "loras": [{"lora_name": "A.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
      )
    })
  }
)
