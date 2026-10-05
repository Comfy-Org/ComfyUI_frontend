import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'DynamicGroup',
  { tag: ['@widget', '@vue-nodes', '@oss'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('inputs/dynamic_group')
      await expect(comfyPage.vueNodes.nodes).toHaveCount(2)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.canvasOps.resetView()
    })

    for (const filenames of [
      [],
      ['A.safetensors', 'B.safetensors', 'A.safetensors']
    ]) {
      test.describe(`legacy notice with ${filenames.length} rows`, () => {
        test.beforeEach(async ({ comfyPage }) => {
          const node = comfyPage.vueNodes.getNodeByTitle(
            'Node With Dynamic Group'
          )
          for (const [index, filename] of filenames.entries()) {
            await node.getByRole('button', { name: 'Add LoRA' }).click()
            await node
              .getByRole('combobox', {
                name: `LoRA #${index + 1} lora_name`,
                exact: true
              })
              .click()
            await comfyPage.page
              .getByRole('option', { name: filename, exact: true })
              .click()
          }
        })

        test(
          'shows one notice and preserves rows when returning to Node 2.0',
          { tag: '@screenshot' },
          async ({ comfyPage }) => {
            const node = comfyPage.vueNodes.getNodeByTitle(
              'Node With Dynamic Group'
            )
            await comfyPage.menu.topbar.setVueNodesEnabled(false)
            await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
            await expect(comfyPage.canvas).toHaveScreenshot(
              `dynamic-group-legacy-${filenames.length}-rows.png`
            )
            const legacyNode = await comfyPage.nodeOps.getNodeRefById('1')
            await (await legacyNode.getWidgetByName('loras.$notice')).click()

            await comfyPage.menu.topbar.setVueNodesEnabled(true)
            await expect(
              node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
            ).toHaveText(filenames)
            await expect(
              node.getByText('LoRA: Node 2.0 only', { exact: true })
            ).toHaveCount(0)
          }
        )
      })
    }

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

    test('copies populated rows and edits the copy independently', async ({
      comfyPage
    }) => {
      const original = comfyPage.vueNodes.getNodeLocator('1')
      await original.getByRole('button', { name: 'Add LoRA' }).click()
      await original.getByRole('button', { name: 'Add LoRA' }).click()
      await original
        .getByRole('combobox', { name: 'LoRA #2 lora_name', exact: true })
        .click()
      await comfyPage.page
        .getByRole('option', { name: 'B.safetensors', exact: true })
        .click()
      await original.getByLabel('LoRA #2 enabled', { exact: true }).click()

      await comfyPage.command.executeCommand('Comfy.Canvas.SelectAll')
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(2)
      await comfyPage.command.executeCommand('Comfy.Canvas.CopySelected')
      const previewBounds = (await comfyPage.vueNodes
        .getNodeLocator('2')
        .boundingBox())!
      await comfyPage.page.mouse.move(
        previewBounds.x + previewBounds.width + 40,
        previewBounds.y
      )
      await comfyPage.command.executeCommand('Comfy.Canvas.PasteFromClipboard')
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(4)
      await comfyPage.command.executeCommand('Comfy.Canvas.SelectAll')
      await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
      await expect(comfyPage.vueNodes.nodes).toHaveCount(4)

      const [, copiedRef] = await comfyPage.nodeOps.getNodeRefsByType(
        'DevToolsNodeWithDynamicGroup'
      )
      const copy = comfyPage.vueNodes.getNodeLocator(String(copiedRef.id))
      await expect(
        copy.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
      ).toHaveText(['A.safetensors', 'B.safetensors'])
      await expect(
        copy.getByLabel('LoRA #2 enabled', { exact: true })
      ).not.toBeChecked()
      await copy
        .getByRole('button', { name: 'Remove LoRA #1', exact: true })
        .click()
      await copy.getByLabel('before', { exact: true }).fill('copy')
      await expect(
        original.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
      ).toHaveText(['A.safetensors', 'B.safetensors'])
      await expect(original.getByLabel('before', { exact: true })).toHaveValue(
        'first'
      )

      await comfyPage.command.executeCommand('Comfy.QueuePrompt')

      await expect(
        comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
      ).toHaveValue(
        '{"before": "first", "loras": [{"lora_name": "A.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "B.safetensors", "strength": 1.0, "enabled": false}], "after": "last"}'
      )
      const [, copiedPreview] =
        await comfyPage.nodeOps.getNodeRefsByType('PreviewAny')
      await expect(
        comfyPage.vueNodes
          .getNodeLocator(String(copiedPreview.id))
          .getByRole('textbox')
      ).toHaveValue(
        '{"before": "copy", "loras": [{"lora_name": "B.safetensors", "strength": 1.0, "enabled": false}], "after": "last"}'
      )
    })

    test('restores sparse API indices as consecutive rows and executes them', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('inputs/dynamic_group_sparse_api')
      const node = comfyPage.vueNodes.getNodeByTitle('Node With Dynamic Group')
      await expect(
        node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
      ).toHaveText(['A.safetensors', 'C.safetensors'])
      await expect(
        node
          .getByRole('group', { name: 'LoRA #2', exact: true })
          .getByRole('spinbutton')
      ).toHaveValue('0.5')
      await expect(
        node.getByLabel('LoRA #2 enabled', { exact: true })
      ).not.toBeChecked()

      const prompt = await comfyPage.workflow.getExportedWorkflow({ api: true })
      expect(prompt['1'].inputs).toEqual({
        before: 'sparse',
        'loras.0.lora_name': 'A.safetensors',
        'loras.0.strength': 0.8,
        'loras.0.enabled': true,
        'loras.1.lora_name': 'C.safetensors',
        'loras.1.strength': 0.5,
        'loras.1.enabled': false,
        after: 'restored'
      })
      await comfyPage.command.executeCommand('Comfy.QueuePrompt')
      await expect(
        comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
      ).toHaveValue(
        '{"before": "sparse", "loras": [{"lora_name": "A.safetensors", "strength": 0.8, "enabled": true}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "restored"}'
      )
    })

    test('preserves over-limit API rows but requires removal before execution', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'inputs/dynamic_group_over_limit_api'
      )
      const node = comfyPage.vueNodes.getNodeByTitle('Node With Dynamic Group')
      const add = node.getByRole('button', { name: 'Add LoRA' })
      const names = node.getByRole('combobox', {
        name: /^LoRA #\d+ lora_name$/
      })
      await expect(names).toHaveText([
        'A.safetensors',
        'B.safetensors',
        'C.safetensors',
        'A.safetensors'
      ])
      await expect(add).toBeDisabled()
      await expect(
        node
          .getByRole('group', { name: 'LoRA #4', exact: true })
          .getByRole('spinbutton')
      ).toHaveValue('0.2')

      const queued = comfyPage.page.waitForResponse('**/api/prompt')
      await comfyPage.command.executeCommand('Comfy.QueuePrompt')
      const response = await queued
      expect(response.status()).toBe(400)
      expect(await response.text()).toContain('max=3')
      const errorDialog = comfyPage.page.getByRole('dialog')
      await expect(
        errorDialog.getByRole('heading', { name: 'Prompt validation failed' })
      ).toBeVisible()
      await errorDialog
        .getByRole('button', { name: 'Close', exact: true })
        .click()

      await node
        .getByRole('button', { name: 'Remove LoRA #4', exact: true })
        .click()
      await expect(names).toHaveText([
        'A.safetensors',
        'B.safetensors',
        'C.safetensors'
      ])
      await expect(add).toBeDisabled()
      await node
        .getByRole('button', { name: 'Remove LoRA #2', exact: true })
        .click()
      await expect(names).toHaveText(['A.safetensors', 'C.safetensors'])
      await expect(add).toBeEnabled()

      await comfyPage.command.executeCommand('Comfy.QueuePrompt')
      await expect(
        comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
      ).toHaveValue(
        '{"before": "over-limit", "loras": [{"lora_name": "A.safetensors", "strength": 0.8, "enabled": true}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "restored"}'
      )
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
        node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
      ).toHaveCount(3)
      await node
        .getByRole('combobox', { name: 'LoRA #2 lora_name', exact: true })
        .click()
      await comfyPage.page
        .getByRole('option', { name: 'B.safetensors', exact: true })
        .click()
      await node
        .getByRole('combobox', { name: 'LoRA #3 lora_name', exact: true })
        .click()
      await comfyPage.page
        .getByRole('option', { name: 'C.safetensors', exact: true })
        .click()
      const strength = node
        .getByRole('group', { name: 'LoRA #3', exact: true })
        .getByRole('spinbutton')
      await strength.fill('0.5')
      await strength.blur()
      await node.getByLabel('LoRA #3 enabled', { exact: true }).click()
      await node
        .getByRole('button', { name: 'Remove LoRA #2', exact: true })
        .click()
      await comfyPage.command.executeCommand('Comfy.Undo')
      await expect(
        node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
      ).toHaveText(['A.safetensors', 'B.safetensors', 'C.safetensors'])
      await comfyPage.command.executeCommand('Comfy.Redo')
      await expect(
        node.getByRole('combobox', { name: 'LoRA #2 lora_name', exact: true })
      ).toHaveText('C.safetensors')
      await expect(
        node.getByLabel('LoRA #2 enabled', { exact: true })
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
      await expect(comfyPage.vueNodes.nodes).toHaveCount(2)
      await comfyPage.menu.workflowsTab.close()
      await expect(node.getByLabel('before', { exact: true })).toHaveValue(
        'head'
      )
      await expect(node.getByLabel('after', { exact: true })).toHaveValue(
        'tail'
      )
      await expect(
        node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
      ).toHaveText(['A.safetensors', 'C.safetensors'])
      await expect(
        node.getByLabel('LoRA #2 enabled', { exact: true })
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
