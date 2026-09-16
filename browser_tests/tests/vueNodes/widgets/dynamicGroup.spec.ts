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

    test('shows one legacy notice per group and preserves rows when returning to Node 2.0', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Node With Dynamic Group')
      for (const rowCount of [0, 3]) {
        for (let row = 0; row < rowCount; row++) {
          await node.getByRole('button', { name: 'Add LoRA' }).click()
        }
        if (rowCount > 0) {
          await node
            .getByRole('combobox', { name: 'lora_name', exact: true })
            .nth(1)
            .click()
          await comfyPage.page
            .getByRole('option', { name: 'B.safetensors', exact: true })
            .click()
        }
        await comfyPage.menu.topbar.setVueNodesEnabled(false)
        await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
        await comfyPage.page.evaluate(() => {
          const node = window.app!.graph.nodes.find(
            (node) => String(node.id) === '1'
          )!
          const drawWidgets = node.drawWidgets
          node.properties.drawnLabels = null
          node.drawWidgets = function (ctx, options) {
            const labels: string[] = []
            const fillText = ctx.fillText
            ctx.fillText = function (text, ...args) {
              labels.push(text)
              fillText.call(this, text, ...args)
            }
            try {
              drawWidgets.call(this, ctx, options)
              node.properties.drawnLabels = labels
            } finally {
              ctx.fillText = fillText
              node.drawWidgets = drawWidgets
            }
          }
          node.setDirtyCanvas(true, true)
        })
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => {
              const labels = window.app!.graph.nodes.find(
                (node) => String(node.id) === '1'
              )!.properties.drawnLabels
              return Array.isArray(labels)
                ? labels.filter((label) => label === 'LoRA: Node 2.0 only')
                    .length
                : 0
            })
          )
          .toBe(1)
        const legacyNode = await comfyPage.nodeOps.getNodeRefById('1')
        await (await legacyNode.getWidgetByName('loras.$notice')).click()

        await comfyPage.menu.topbar.setVueNodesEnabled(true)
        await expect(
          node.getByRole('combobox', { name: 'lora_name', exact: true })
        ).toHaveCount(rowCount)
        await expect(
          node.getByText('LoRA: Node 2.0 only', { exact: true })
        ).toHaveCount(0)
        if (rowCount > 0) {
          await expect(
            node.getByRole('combobox', { name: 'lora_name', exact: true })
          ).toHaveText(['A.safetensors', 'B.safetensors', 'A.safetensors'])
        }
      }
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
      await expect(comfyPage.vueNodes.nodes).toHaveCount(2)
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
