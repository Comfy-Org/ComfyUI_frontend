import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { getConnectedInputs } from '@e2e/fixtures/utils/nodeInputLinks'
import { getPromotedWidgetNames } from '@e2e/fixtures/utils/promotedWidgets'

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

    test.describe('subgraphs and drafts', { tag: '@subgraph' }, () => {
      test.use({ initialSettings: { 'Comfy.Workflow.Persist': true } })

      test.beforeEach(async ({ comfyPage }) => {
        const node = comfyPage.vueNodes.getNodeByTitle(
          'Node With Dynamic Group'
        )
        await node.getByLabel('before', { exact: true }).fill('head')
        await node.getByLabel('after', { exact: true }).fill('tail')
        for (const [index, filename] of [
          'A.safetensors',
          'B.safetensors',
          'C.safetensors'
        ].entries()) {
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
        const strength = node
          .getByRole('group', { name: 'LoRA #3', exact: true })
          .getByRole('spinbutton')
        await strength.fill('0.5')
        await strength.blur()
        await node.getByLabel('LoRA #3 enabled', { exact: true }).click()
      })

      test('restores populated rows from an unsaved draft after refreshing the tab', async ({
        comfyPage
      }) => {
        const before = await comfyPage.workflow.getExportedWorkflow({
          api: true
        })
        await comfyPage.workflow.waitForDraftPersisted()
        await comfyPage.workflow.reloadAndWaitForApp()
        const node = comfyPage.vueNodes.getNodeByTitle(
          'Node With Dynamic Group'
        )
        await expect(
          node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
        ).toHaveText(['A.safetensors', 'B.safetensors', 'C.safetensors'])
        await expect(
          node
            .getByRole('group', { name: 'LoRA #3', exact: true })
            .getByRole('spinbutton')
        ).toHaveValue('0.5')
        await expect(
          node.getByLabel('LoRA #3 enabled', { exact: true })
        ).not.toBeChecked()
        expect(
          await comfyPage.workflow.getExportedWorkflow({ api: true })
        ).toEqual(before)
        await comfyPage.command.executeCommand('Comfy.QueuePrompt')
        await expect(
          comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
        ).toHaveValue(
          '{"before": "head", "loras": [{"lora_name": "A.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "B.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
        )
      })

      test('preserves rows when wrapping a node and entering and leaving its subgraph', async ({
        comfyPage
      }) => {
        const before = await comfyPage.workflow.getExportedWorkflow({
          api: true
        })
        const fixture = await comfyPage.vueNodes.getFixtureByTitle(
          'Node With Dynamic Group'
        )
        await comfyPage.contextMenu.openForVueNode(fixture.header)
        await comfyPage.contextMenu.clickMenuItemExact('Convert to Subgraph')
        const hostId = await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
        const converted = await comfyPage.workflow.getExportedWorkflow({
          api: true
        })
        expect(
          Object.values(converted).find(
            (node) => node.class_type === 'DevToolsNodeWithDynamicGroup'
          )?.inputs
        ).toEqual(before['1'].inputs)
        await comfyPage.vueNodes.enterSubgraph(hostId)
        const node = comfyPage.vueNodes.getNodeByTitle(
          'Node With Dynamic Group'
        )
        await expect(
          node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
        ).toHaveText(['A.safetensors', 'B.safetensors', 'C.safetensors'])
        await expect(
          node
            .getByRole('group', { name: 'LoRA #3', exact: true })
            .getByRole('spinbutton')
        ).toHaveValue('0.5')
        await expect(
          node.getByLabel('LoRA #3 enabled', { exact: true })
        ).not.toBeChecked()
        await comfyPage.page
          .getByTestId(TestIds.breadcrumb.item('root'))
          .click()
        expect(
          await comfyPage.workflow.getExportedWorkflow({ api: true })
        ).toEqual(converted)
        await comfyPage.command.executeCommand('Comfy.QueuePrompt')
        await expect(
          comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
        ).toHaveValue(
          '{"before": "head", "loras": [{"lora_name": "A.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "B.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
        )
      })

      test.describe('promoted row', () => {
        test.beforeEach(async ({ comfyPage }) => {
          const fixture = await comfyPage.vueNodes.getFixtureByTitle(
            'Node With Dynamic Group'
          )
          await comfyPage.contextMenu.openForVueNode(fixture.header)
          await comfyPage.contextMenu.clickMenuItemExact('Convert to Subgraph')
          await comfyPage.vueNodes.enterSubgraph()
          await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
          const node = comfyPage.vueNodes.getNodeByTitle(
            'Node With Dynamic Group'
          )
          await comfyPage.subgraph.promoteWidget(node, 'LoRA #2 lora_name')
          await comfyPage.contextMenu.openFor(
            node
              .getByRole('group', { name: 'LoRA #2', exact: true })
              .getByText('strength', { exact: true })
          )
          await comfyPage.contextMenu.clickMenuItemExact(
            'Promote Widget: LoRA #2 strength'
          )
          await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
          await comfyPage.subgraph.promoteWidget(node, 'LoRA #2 enabled')
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
        })

        test('edits promoted row fields and executes the host values', async ({
          comfyPage
        }) => {
          const host = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
          await expect(
            host.getByRole('combobox', {
              name: 'LoRA #2 lora_name',
              exact: true
            })
          ).toHaveText('B.safetensors')
          await host
            .getByRole('combobox', { name: 'LoRA #2 lora_name', exact: true })
            .click()
          await comfyPage.page
            .getByRole('option', { name: 'A.safetensors', exact: true })
            .click()
          await comfyPage.vueNodes.setInputNumberValue(
            comfyPage.vueNodes.getWidgetRowByLabel(
              'New Subgraph',
              'LoRA #2 strength'
            ),
            '0.2'
          )
          await host.getByLabel('LoRA #2 enabled', { exact: true }).click()
          await comfyPage.vueNodes.enterSubgraph()
          const node = comfyPage.vueNodes.getNodeByTitle(
            'Node With Dynamic Group'
          )
          await expect(
            node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
          ).toHaveText(['A.safetensors', 'C.safetensors'])
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          await comfyPage.command.executeCommand('Comfy.QueuePrompt')
          await expect(
            comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
          ).toHaveValue(
            '{"before": "head", "loras": [{"lora_name": "A.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "A.safetensors", "strength": 0.2, "enabled": false}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
          )
        })

        test('keeps promotion on the same row when an earlier row is removed', async ({
          comfyPage
        }) => {
          const hostId =
            await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
          await comfyPage.vueNodes.enterSubgraph(hostId)
          const node = comfyPage.vueNodes.getNodeByTitle(
            'Node With Dynamic Group'
          )
          await node
            .getByRole('button', { name: 'Remove LoRA #1', exact: true })
            .click()
          await expect(
            node.getByRole('button', { name: /Remove LoRA/ })
          ).toHaveCount(2)
          await expect(
            node.getByRole('combobox', {
              name: 'LoRA #2 lora_name',
              exact: true
            })
          ).toHaveText('C.safetensors')
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          const host = comfyPage.vueNodes.getNodeLocator(hostId)
          await expect(
            host.getByRole('combobox', {
              name: 'LoRA #1 lora_name',
              exact: true
            })
          ).toHaveText('B.safetensors')
          await expect
            .poll(() => getPromotedWidgetNames(comfyPage, hostId))
            .toEqual([
              'loras.0.lora_name',
              'loras.0.strength',
              'loras.0.enabled'
            ])
          await comfyPage.vueNodes.setInputNumberValue(
            comfyPage.vueNodes.getWidgetRowByLabel(
              'New Subgraph',
              'LoRA #1 strength'
            ),
            '0.2'
          )
          await comfyPage.command.executeCommand('Comfy.QueuePrompt')
          await expect(
            comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
          ).toHaveValue(
            '{"before": "head", "loras": [{"lora_name": "B.safetensors", "strength": 0.2, "enabled": true}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
          )
        })

        test('disconnects promotion and removes host widgets when their interior row is deleted', async ({
          comfyPage
        }) => {
          const hostId =
            await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
          await expect
            .poll(() => getPromotedWidgetNames(comfyPage, hostId))
            .toEqual(
              expect.arrayContaining([
                'loras.1.lora_name',
                'loras.1.strength',
                'loras.1.enabled'
              ])
            )
          await comfyPage.vueNodes.enterSubgraph(hostId)
          const nodeId = await comfyPage.vueNodes.getNodeIdByTitle(
            'Node With Dynamic Group'
          )
          await expect
            .poll(() => getConnectedInputs(comfyPage, nodeId, 'loras.'))
            .toHaveLength(3)
          await expect
            .poll(() => comfyPage.subgraph.getDefinitionInventory())
            .toEqual([{ name: 'New Subgraph', nodes: 1, links: 4 }])
          const node = comfyPage.vueNodes.getNodeLocator(nodeId)
          await node
            .getByRole('button', { name: 'Remove LoRA #2', exact: true })
            .click()
          await expect(
            node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
          ).toHaveText(['A.safetensors', 'C.safetensors'])
          await expect
            .poll(() => getConnectedInputs(comfyPage, nodeId, 'loras.'))
            .toEqual([])
          await expect
            .poll(() => comfyPage.subgraph.getDefinitionInventory())
            .toEqual([{ name: 'New Subgraph', nodes: 1, links: 1 }])
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          const host = comfyPage.vueNodes.getNodeLocator(hostId)
          await expect(host.getByRole('combobox')).toHaveCount(0)
          await expect(host.getByRole('spinbutton')).toHaveCount(0)
          await expect(host.getByRole('switch')).toHaveCount(0)
          await expect
            .poll(() => getPromotedWidgetNames(comfyPage, hostId))
            .toEqual([])
          await comfyPage.command.executeCommand('Comfy.QueuePrompt')
          await expect(
            comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
          ).toHaveValue(
            '{"before": "head", "loras": [{"lora_name": "A.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
          )
        })

        test('restores a deleted promoted row with Undo and removes it again with Redo', async ({
          comfyPage
        }) => {
          test.slow()
          const hostId =
            await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
          const host = comfyPage.vueNodes.getNodeLocator(hostId)
          await comfyPage.vueNodes.setInputNumberValue(
            comfyPage.vueNodes.getWidgetRowByLabel(
              'New Subgraph',
              'LoRA #2 strength'
            ),
            '0.2'
          )
          await host.getByLabel('LoRA #2 enabled', { exact: true }).click()
          const before = await comfyPage.workflow.getExportedWorkflow({
            api: true
          })
          await comfyPage.vueNodes.enterSubgraph(hostId)
          const nodeId = await comfyPage.vueNodes.getNodeIdByTitle(
            'Node With Dynamic Group'
          )
          const node = comfyPage.vueNodes.getNodeLocator(nodeId)
          await node
            .getByRole('button', { name: 'Remove LoRA #2', exact: true })
            .click()
          await expect
            .poll(() => getConnectedInputs(comfyPage, nodeId, 'loras.'))
            .toEqual([])

          await comfyPage.command.executeCommand('Comfy.Undo')
          await expect(
            node.getByRole('button', { name: /Remove LoRA/ })
          ).toHaveCount(3)
          await expect
            .poll(() => getConnectedInputs(comfyPage, nodeId, 'loras.'))
            .toHaveLength(3)
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          await expect(
            host.getByRole('combobox', {
              name: 'LoRA #2 lora_name',
              exact: true
            })
          ).toHaveText('B.safetensors')
          await expect(host.getByRole('spinbutton')).toHaveValue('0.2')
          await expect(
            host.getByLabel('LoRA #2 enabled', { exact: true })
          ).not.toBeChecked()
          expect(
            await comfyPage.workflow.getExportedWorkflow({ api: true })
          ).toEqual(before)

          await comfyPage.command.executeCommand('Comfy.Redo')
          await expect(host.getByRole('combobox')).toHaveCount(0)
          await expect(host.getByRole('spinbutton')).toHaveCount(0)
          await expect(host.getByRole('switch')).toHaveCount(0)
          await comfyPage.workflow.waitForDraftPersisted()
          await comfyPage.workflow.reloadAndWaitForApp()
          await expect
            .poll(() => getPromotedWidgetNames(comfyPage, hostId))
            .toEqual([])
          await comfyPage.vueNodes.enterSubgraph(hostId)
          await expect(
            node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
          ).toHaveText(['A.safetensors', 'C.safetensors'])
          await expect
            .poll(() => getConnectedInputs(comfyPage, nodeId, 'loras.'))
            .toEqual([])
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          await comfyPage.command.executeCommand('Comfy.QueuePrompt')
          await expect(
            comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
          ).toHaveValue(
            '{"before": "head", "loras": [{"lora_name": "A.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
          )
        })

        test('copies subgraph hosts without mixing their promoted row values', async ({
          comfyPage
        }) => {
          test.slow()
          const originalId =
            await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
          await comfyPage.command.executeCommand('Comfy.Canvas.SelectAll')
          await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(2)
          await comfyPage.command.executeCommand('Comfy.Canvas.CopySelected')
          const bounds = (await comfyPage.vueNodes
            .getNodeLocator('2')
            .boundingBox())!
          await comfyPage.page.mouse.move(
            bounds.x + bounds.width + 40,
            bounds.y
          )
          await comfyPage.command.executeCommand(
            'Comfy.Canvas.PasteFromClipboard'
          )
          await expect
            .poll(() => comfyPage.nodeOps.getGraphNodesCount())
            .toBe(4)
          await comfyPage.command.executeCommand('Comfy.Canvas.SelectAll')
          await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
          const hostRefs =
            await comfyPage.nodeOps.getNodeRefsByTitle('New Subgraph')
          const originalRef = hostRefs.find(
            (node) => String(node.id) === originalId
          )!
          const copyRef = hostRefs.find(
            (node) => String(node.id) !== originalId
          )!
          expect(originalRef).toBeDefined()
          expect(copyRef).toBeDefined()
          expect(await copyRef.getType()).not.toBe(await originalRef.getType())
          const original = comfyPage.vueNodes.getNodeLocator(originalId)
          const copy = comfyPage.vueNodes.getNodeLocator(String(copyRef.id))
          await original.getByRole('spinbutton').fill('0.2')
          await original.getByRole('spinbutton').blur()
          await copy.getByRole('spinbutton').fill('0.7')
          await copy.getByRole('spinbutton').blur()
          await copy
            .getByRole('combobox', { name: 'LoRA #2 lora_name', exact: true })
            .click()
          await comfyPage.page
            .getByRole('option', { name: 'A.safetensors', exact: true })
            .click()
          await copy.getByLabel('LoRA #2 enabled', { exact: true }).click()
          await expect(
            original.getByRole('combobox', {
              name: 'LoRA #2 lora_name',
              exact: true
            })
          ).toHaveText('B.safetensors')
          await expect(original.getByRole('spinbutton')).toHaveValue('0.2')

          await comfyPage.vueNodes.enterSubgraph(originalId)
          await comfyPage.vueNodes
            .getNodeByTitle('Node With Dynamic Group')
            .getByRole('button', { name: 'Remove LoRA #1', exact: true })
            .click()
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          await expect(
            original.getByRole('combobox', {
              name: 'LoRA #1 lora_name',
              exact: true
            })
          ).toHaveText('B.safetensors')
          await expect(
            copy.getByRole('combobox', {
              name: 'LoRA #2 lora_name',
              exact: true
            })
          ).toHaveText('A.safetensors')
          await expect(original.getByRole('spinbutton')).toHaveValue('0.2')
          await expect(copy.getByRole('spinbutton')).toHaveValue('0.7')
          await comfyPage.workflow.waitForDraftPersisted()
          await comfyPage.workflow.reloadAndWaitForApp()
          await expect(original.getByRole('spinbutton')).toHaveValue('0.2')
          await expect(copy.getByRole('spinbutton')).toHaveValue('0.7')
          await comfyPage.command.executeCommand('Comfy.QueuePrompt')
          await expect(
            comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
          ).toHaveValue(
            '{"before": "head", "loras": [{"lora_name": "B.safetensors", "strength": 0.2, "enabled": true}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
          )
          const [, copiedPreview] =
            await comfyPage.nodeOps.getNodeRefsByType('PreviewAny')
          await expect(
            comfyPage.vueNodes
              .getNodeLocator(String(copiedPreview.id))
              .getByRole('textbox')
          ).toHaveValue(
            '{"before": "head", "loras": [{"lora_name": "A.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "A.safetensors", "strength": 0.7, "enabled": false}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
          )
        })

        test.describe('two-level promotion', () => {
          test.beforeEach(async ({ comfyPage }) => {
            const fixture =
              await comfyPage.vueNodes.getFixtureByTitle('New Subgraph')
            await comfyPage.contextMenu.openForVueNode(fixture.header)
            await comfyPage.contextMenu.clickMenuItemExact(
              'Convert to Subgraph'
            )
            await comfyPage.vueNodes.enterSubgraph()
            await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
            const inner = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
            await comfyPage.subgraph.promoteWidget(inner, 'LoRA #2 lora_name')
            await comfyPage.contextMenu.openFor(
              comfyPage.vueNodes
                .getWidgetRowByLabel('New Subgraph', 'LoRA #2 strength')
                .getByText('LoRA #2 strength', { exact: true })
            )
            await comfyPage.contextMenu.clickMenuItemExact(
              'Promote Widget: LoRA #2 strength'
            )
            await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
            await comfyPage.subgraph.promoteWidget(inner, 'LoRA #2 enabled')
            await comfyPage.page
              .getByTestId(TestIds.breadcrumb.item('root'))
              .click()
          })

          test('executes top-level edits through two promotion boundaries after draft reload', async ({
            comfyPage
          }) => {
            const outerId =
              await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
            const outer = comfyPage.vueNodes.getNodeLocator(outerId)
            await outer
              .getByRole('combobox', { name: 'LoRA #2 lora_name', exact: true })
              .click()
            await comfyPage.page
              .getByRole('option', { name: 'A.safetensors', exact: true })
              .click()
            await outer.getByRole('spinbutton').fill('0.2')
            await outer.getByRole('spinbutton').blur()
            await outer.getByLabel('LoRA #2 enabled', { exact: true }).click()
            await comfyPage.workflow.waitForDraftPersisted()
            await comfyPage.workflow.reloadAndWaitForApp()
            await expect(
              outer.getByRole('combobox', {
                name: 'LoRA #2 lora_name',
                exact: true
              })
            ).toHaveText('A.safetensors')
            await expect(outer.getByRole('spinbutton')).toHaveValue('0.2')
            await expect(
              outer.getByLabel('LoRA #2 enabled', { exact: true })
            ).not.toBeChecked()
            await comfyPage.command.executeCommand('Comfy.QueuePrompt')
            await expect(
              comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
            ).toHaveValue(
              '{"before": "head", "loras": [{"lora_name": "A.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "A.safetensors", "strength": 0.2, "enabled": false}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
            )
          })

          test('keeps top-level edits on the same row after its index changes across two boundaries', async ({
            comfyPage
          }) => {
            test.slow()
            const outerId =
              await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
            const outer = comfyPage.vueNodes.getNodeLocator(outerId)
            await expect(
              outer.getByRole('combobox', {
                name: 'LoRA #2 lora_name',
                exact: true
              })
            ).toHaveText('B.safetensors')
            await outer.getByRole('spinbutton').fill('0.2')
            await outer.getByRole('spinbutton').blur()
            await outer.getByLabel('LoRA #2 enabled', { exact: true }).click()
            await comfyPage.vueNodes.enterSubgraph(outerId)
            await comfyPage.vueNodes.enterSubgraph()
            const node = comfyPage.vueNodes.getNodeByTitle(
              'Node With Dynamic Group'
            )
            await node
              .getByRole('button', { name: 'Remove LoRA #1', exact: true })
              .click()
            await comfyPage.page
              .getByTestId(TestIds.breadcrumb.item('root'))
              .click()
            await expect
              .soft(
                outer.getByRole('combobox', {
                  name: 'LoRA #1 lora_name',
                  exact: true
                })
              )
              .toHaveText('B.safetensors')
            await expect(outer.getByRole('spinbutton')).toHaveValue('0.2')
            await expect
              .soft(outer.getByLabel('LoRA #1 enabled', { exact: true }))
              .not.toBeChecked()
            await comfyPage.workflow.waitForDraftPersisted()
            await comfyPage.workflow.reloadAndWaitForApp()
            await expect
              .soft(
                outer.getByRole('combobox', {
                  name: 'LoRA #1 lora_name',
                  exact: true
                })
              )
              .toHaveText('B.safetensors')
            await comfyPage.command.executeCommand('Comfy.QueuePrompt')
            await expect(
              comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
            ).toHaveValue(
              '{"before": "head", "loras": [{"lora_name": "B.safetensors", "strength": 0.2, "enabled": false}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
            )
          })

          test('removes promotion at both boundaries when the interior row is deleted', async ({
            comfyPage
          }) => {
            test.slow()
            const outerId =
              await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
            await comfyPage.vueNodes.enterSubgraph(outerId)
            const innerId =
              await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
            await comfyPage.vueNodes.enterSubgraph(innerId)
            const node = comfyPage.vueNodes.getNodeByTitle(
              'Node With Dynamic Group'
            )
            await node
              .getByRole('button', { name: 'Remove LoRA #2', exact: true })
              .click()
            await expect(
              node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
            ).toHaveText(['A.safetensors', 'C.safetensors'])
            await comfyPage.page
              .getByTestId(TestIds.breadcrumb.item('root'))
              .click()
            const outer = comfyPage.vueNodes.getNodeLocator(outerId)
            await expect(outer.getByRole('combobox')).toHaveCount(0)
            await expect(outer.getByRole('spinbutton')).toHaveCount(0)
            await expect(outer.getByRole('switch')).toHaveCount(0)
            await expect
              .poll(() => getPromotedWidgetNames(comfyPage, outerId))
              .toEqual([])
            await comfyPage.vueNodes.enterSubgraph(outerId)
            await expect
              .poll(() => getPromotedWidgetNames(comfyPage, innerId))
              .toEqual([])
            await expect
              .poll(() => comfyPage.subgraph.getDefinitionInventory())
              .toEqual([
                { name: 'New Subgraph', nodes: 1, links: 1 },
                { name: 'New Subgraph', nodes: 1, links: 1 }
              ])
            await comfyPage.page
              .getByTestId(TestIds.breadcrumb.item('root'))
              .click()
            await comfyPage.command.executeCommand('Comfy.QueuePrompt')
            await expect(
              comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
            ).toHaveValue(
              '{"before": "head", "loras": [{"lora_name": "A.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
            )
            await comfyPage.workflow.waitForDraftPersisted()
            await comfyPage.workflow.reloadAndWaitForApp()
            await expect(outer.getByRole('combobox')).toHaveCount(0)
            await expect(outer.getByRole('spinbutton')).toHaveCount(0)
            await expect(outer.getByRole('switch')).toHaveCount(0)
          })
        })

        test('restores a promoted row draft at the root before entering its subgraph', async ({
          comfyPage
        }) => {
          const before = await comfyPage.workflow.getExportedWorkflow({
            api: true
          })
          const hostId =
            await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
          await comfyPage.workflow.waitForDraftPersisted()
          await comfyPage.workflow.reloadAndWaitForApp()
          await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
          expect(
            await comfyPage.workflow.getExportedWorkflow({ api: true })
          ).toEqual(before)
          await comfyPage.vueNodes.enterSubgraph(hostId)
          const node = comfyPage.vueNodes.getNodeByTitle(
            'Node With Dynamic Group'
          )
          await expect(
            node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
          ).toHaveText(['A.safetensors', 'C.safetensors'])
          await expect(
            node
              .getByRole('group', { name: 'LoRA #3', exact: true })
              .getByRole('spinbutton')
          ).toHaveValue('0.5')
          await expect(
            node.getByLabel('LoRA #3 enabled', { exact: true })
          ).not.toBeChecked()
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          await expect(
            comfyPage.vueNodes
              .getNodeLocator(hostId)
              .getByRole('combobox', { name: 'LoRA #2 lora_name', exact: true })
          ).toHaveText('B.safetensors')
          await comfyPage.command.executeCommand('Comfy.QueuePrompt')
          await expect(
            comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
          ).toHaveValue(
            '{"before": "head", "loras": [{"lora_name": "A.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "B.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
          )
        })

        test('restores a promoted row draft directly inside its subgraph', async ({
          comfyPage
        }) => {
          const before = await comfyPage.workflow.getExportedWorkflow({
            api: true
          })
          const hostId =
            await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
          await comfyPage.vueNodes.enterSubgraph(hostId)
          await comfyPage.workflow.waitForDraftPersisted()
          await comfyPage.workflow.reloadAndWaitForApp()
          await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)
          expect(
            await comfyPage.workflow.getExportedWorkflow({ api: true })
          ).toEqual(before)
          const node = comfyPage.vueNodes.getNodeByTitle(
            'Node With Dynamic Group'
          )
          await expect(
            node.getByRole('combobox', { name: /^LoRA #\d+ lora_name$/ })
          ).toHaveText(['A.safetensors', 'C.safetensors'])
          await expect(
            node
              .getByRole('group', { name: 'LoRA #3', exact: true })
              .getByRole('spinbutton')
          ).toHaveValue('0.5')
          await expect(
            node.getByLabel('LoRA #3 enabled', { exact: true })
          ).not.toBeChecked()
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          await expect(
            comfyPage.vueNodes
              .getNodeLocator(hostId)
              .getByRole('combobox', { name: 'LoRA #2 lora_name', exact: true })
          ).toHaveText('B.safetensors')
          await comfyPage.command.executeCommand('Comfy.QueuePrompt')
          await expect(
            comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
          ).toHaveValue(
            '{"before": "head", "loras": [{"lora_name": "A.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "B.safetensors", "strength": 1.0, "enabled": true}, {"lora_name": "C.safetensors", "strength": 0.5, "enabled": false}], "after": "tail"}'
          )
        })
      })
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
