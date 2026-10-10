import { expect } from '@playwright/test'

import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'
import { NATIVE_LORA_ASSETS } from '@e2e/fixtures/data/nativeLoraAssets'
import { TestIds } from '@e2e/fixtures/selectors'
import { getConnectedInputs } from '@e2e/fixtures/utils/nodeInputLinks'
import { getPromotedWidgetNames } from '@e2e/fixtures/utils/promotedWidgets'

import { nativeLoraTest as test } from '@e2e/fixtures/nativeLoraFixture'

test.describe(
  'Native LoRA stack assets',
  { tag: ['@cloud', '@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('inputs/native_lora_model')
      await expect(comfyPage.vueNodes.nodes).toHaveCount(4)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.canvasOps.resetView()
    })

    test.describe('node creation and model drops', () => {
      test.use({
        initialSettings: { 'Comfy.ModelLibrary.UseAssetBrowser': false }
      })

      for (const title of ['Load LoRA (Model)', 'Load LoRA (Text Encoder)']) {
        test(`opens asset popovers on a new ${title} node and its added row`, async ({
          comfyPage
        }) => {
          await comfyPage.nodeOps.clearGraph()
          const id = await comfyPage.searchBoxV2.addNodeAndGetId(title)
          const node = comfyPage.vueNodes.getNodeLocator(id)
          const first = new WidgetSelectDropdownFixture(
            node.getByRole('group', { name: 'LoRA #1', exact: true })
          )
          await first.selectOption('B.safetensors')
          await node.getByRole('button', { name: 'Add LoRA' }).click()
          const second = new WidgetSelectDropdownFixture(
            node.getByRole('group', { name: 'LoRA #2', exact: true })
          )
          await second.open()
          const popover = comfyPage.page.getByTestId(
            TestIds.widgets.formDropdownMenu
          )
          await expect(popover).toBeVisible()
          await expect(
            popover.getByText('A.safetensors', { exact: true })
          ).toBeVisible()
          await expect(
            popover.getByText('B.safetensors', { exact: true })
          ).toBeVisible()
          await popover.getByText('C.safetensors', { exact: true }).click()
          await expect(popover).toBeHidden()
          await expect(first.selection).toHaveText('B.safetensors')
          await expect(second.selection).toHaveText('C.safetensors')
          const ref = await comfyPage.nodeOps.getNodeRefById(id)
          expect(
            await (await ref.getWidgetByName('loras.0.lora_name')).getValue()
          ).toBe('native-lora-e2e/B.safetensors')
          expect(
            await (await ref.getWidgetByName('loras.1.lora_name')).getValue()
          ).toBe('native-lora-e2e/C.safetensors')
        })
      }

      test('previews and places the default LoRA loader with the selected asset', async ({
        comfyPage
      }) => {
        await comfyPage.nodeOps.clearGraph()
        await comfyPage.command.executeCommand('Comfy.BrowseModelAssets')
        const modal = comfyPage.page.locator(
          '[data-component-id="AssetBrowserModal"]'
        )
        await expect(modal).toBeVisible()
        const card = modal.locator(
          `[data-component-id="AssetCard"][data-asset-id="${NATIVE_LORA_ASSETS[1].id}"]`
        )
        await card.getByRole('button', { name: 'Use' }).click()
        await expect(modal).toBeHidden()
        const preview = comfyPage.page.locator(
          '[data-node-id="preview-LoraLoader"]'
        )
        await expect(preview).toBeVisible()
        await expect(preview).toContainText('B.safetensors')
        expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
        const box = (await comfyPage.canvas.boundingBox())!
        await comfyPage.canvas.click({
          position: { x: box.width / 2, y: box.height / 2 }
        })
        await expect(preview).toBeHidden()
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
        const [loader] = await comfyPage.nodeOps.getNodeRefsByType('LoraLoader')
        expect(
          await (await loader.getWidgetByName('lora_name')).getValue()
        ).toBe('native-lora-e2e/B.safetensors')
      })

      test('drops a model onto only the first matching native row and executes it', async ({
        comfyPage,
        lora
      }) => {
        await lora.populate()
        const before = await comfyPage.workflow.getExportedWorkflow({
          api: true
        })
        const tab = comfyPage.menu.modelLibraryTab
        await tab.open()
        await tab.getFolderByLabel('loras').click()
        await tab.getFolderByLabel('native-lora-e2e').click()
        await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
        await comfyPage.canvasOps.waitForViewToSettle()
        await tab.getLeafByLabel('C').dragTo(lora.row(2))
        await comfyPage.nextFrame()
        await lora.expectNames([
          'C.safetensors',
          'B.safetensors',
          'C.safetensors'
        ])
        const after = await comfyPage.workflow.getExportedWorkflow({
          api: true
        })
        expect(after).toEqual({
          ...before,
          '1': {
            ...before['1'],
            inputs: {
              ...before['1'].inputs,
              'loras.0.lora_name': 'native-lora-e2e/C.safetensors'
            }
          }
        })
        await lora.execute('9.000')
      })

      test('creates a loader when a model is dragged onto empty canvas', async ({
        comfyPage
      }) => {
        await comfyPage.nodeOps.clearGraph()
        const tab = comfyPage.menu.modelLibraryTab
        await tab.open()
        await tab.getFolderByLabel('loras').click()
        await tab.getFolderByLabel('native-lora-e2e').click()
        const box = (await comfyPage.canvas.boundingBox())!
        await tab.getLeafByLabel('C').dragTo(comfyPage.canvas, {
          targetPosition: { x: box.width / 2, y: box.height / 2 }
        })
        await comfyPage.nextFrame()
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
        const [loader] = await comfyPage.nodeOps.getNodeRefsByType('LoraLoader')
        const filename = await loader.getWidgetByName('lora_name')
        expect(await filename.getValue()).toBe('native-lora-e2e/C.safetensors')
      })
    })

    test('selects an asset and executes the minimum row through the native model loader', async ({
      comfyPage,
      lora
    }) => {
      await lora.picker(1).selectOption('B.safetensors')
      await expect(
        lora.node.getByRole('button', { name: 'Remove LoRA #1', exact: true })
      ).toBeDisabled()
      const prompt = await comfyPage.workflow.getExportedWorkflow({ api: true })
      expect(prompt['1']).toMatchObject({
        class_type: 'LoadLoraModel',
        inputs: {
          'loras.0.lora_name': 'native-lora-e2e/B.safetensors',
          'loras.0.strength': 1,
          'loras.0.enabled': true
        }
      })
      await lora.execute('3.000')
    })

    test('selects assets and applies stacked weights through the native text encoder loader', async ({
      comfyPage,
      lora
    }) => {
      await comfyPage.workflow.loadWorkflow('inputs/native_lora_clip')
      await lora.populate()
      const prompt = await comfyPage.workflow.getExportedWorkflow({ api: true })
      expect(prompt['1'].class_type).toBe('LoadLoraTextEncoder')
      expect(prompt['1'].inputs['loras.2.lora_name']).toBe(
        'native-lora-e2e/C.safetensors'
      )
      await lora.execute('6.000')
    })

    test('preserves 1 row while switching through the legacy notice', async ({
      comfyPage,
      lora
    }) => {
      const before = await comfyPage.workflow.getExportedWorkflow({
        api: true
      })
      await comfyPage.menu.topbar.setVueNodesEnabled(false)
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
      const ref = await comfyPage.nodeOps.getNodeRefById('1')
      await (await ref.getWidgetByName('loras.$notice')).click()
      await comfyPage.menu.topbar.setVueNodesEnabled(true)
      await lora.expectNames(['A.safetensors'])
      expect(
        await comfyPage.workflow.getExportedWorkflow({ api: true })
      ).toEqual(before)
      await lora.execute('2.000')
    })

    test('preserves 3 rows while switching through the legacy notice', async ({
      comfyPage,
      lora
    }) => {
      await lora.populate()
      const before = await comfyPage.workflow.getExportedWorkflow({
        api: true
      })
      await comfyPage.menu.topbar.setVueNodesEnabled(false)
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
      const ref = await comfyPage.nodeOps.getNodeRefById('1')
      await (await ref.getWidgetByName('loras.$notice')).click()
      await comfyPage.menu.topbar.setVueNodesEnabled(true)
      await lora.expectNames([
        'A.safetensors',
        'B.safetensors',
        'C.safetensors'
      ])
      expect(
        await comfyPage.workflow.getExportedWorkflow({ api: true })
      ).toEqual(before)
      await lora.execute('6.000')
    })

    for (const workflow of ['native_lora_model', 'native_lora_clip']) {
      test(`preserves disabled row values through save/reopen and re-enables their strength in ${workflow}`, async ({
        comfyPage,
        lora
      }) => {
        await comfyPage.workflow.loadWorkflow(`inputs/${workflow}`)
        await lora.populate()
        const before = await comfyPage.workflow.getExportedWorkflow({
          api: true
        })
        const enabled = lora.row(2).getByRole('switch')
        await expect(enabled).toBeChecked()
        await enabled.uncheck()
        await lora.execute('4.000')
        await comfyPage.menu.topbar.saveWorkflow('native-lora-enabled')
        await comfyPage.menu.topbar.closeWorkflowTab('native-lora-enabled')
        await comfyPage.menu.workflowsTab.open()
        await comfyPage.menu.workflowsTab
          .getPersistedItem('native-lora-enabled')
          .dblclick()
        await comfyPage.menu.workflowsTab.close()
        await expect(enabled).not.toBeChecked()
        await expect(lora.picker(2).selection).toHaveText('B.safetensors')
        await expect(lora.row(2).getByRole('spinbutton')).toHaveAttribute(
          'aria-valuenow',
          '1'
        )
        const restored = await comfyPage.workflow.getExportedWorkflow({
          api: true
        })
        expect(restored['1'].inputs).toEqual({
          ...before['1'].inputs,
          'loras.1.enabled': false
        })
        await lora.execute('4.000')
        await enabled.check()
        expect(
          (await comfyPage.workflow.getExportedWorkflow({ api: true }))['1']
            .inputs
        ).toEqual(before['1'].inputs)
        await lora.execute('6.000')
      })
    }

    test.describe('populated rows', () => {
      test.use({ initialSettings: { 'Comfy.Workflow.Persist': true } })

      test.beforeEach(async ({ lora }) => {
        await lora.populate()
      })

      test('restores an unsaved draft after refreshing the tab', async ({
        comfyPage,
        lora
      }) => {
        const before = await comfyPage.workflow.getExportedWorkflow({
          api: true
        })
        await comfyPage.workflow.waitForDraftPersisted()
        await comfyPage.workflow.reloadAndWaitForApp()
        await lora.expectNames([
          'A.safetensors',
          'B.safetensors',
          'C.safetensors'
        ])
        await expect(lora.row(3).getByRole('spinbutton')).toHaveAttribute(
          'aria-valuenow',
          '0.5'
        )
        expect(
          await comfyPage.workflow.getExportedWorkflow({ api: true })
        ).toEqual(before)
        await lora.execute('6.000')
      })

      test('preserves inputs when wrapping a node and entering and leaving its subgraph', async ({
        comfyPage,
        lora
      }) => {
        const before = await comfyPage.workflow.getExportedWorkflow({
          api: true
        })
        const node =
          await comfyPage.vueNodes.getFixtureByTitle('Load LoRA (Model)')
        await comfyPage.contextMenu.openForVueNode(node.header)
        await comfyPage.contextMenu.clickMenuItemExact('Convert to Subgraph')
        const converted = await comfyPage.workflow.getExportedWorkflow({
          api: true
        })
        expect(
          Object.values(converted).find(
            (entry) => entry.class_type === 'LoadLoraModel'
          )?.inputs
        ).toEqual(before['1'].inputs)
        await comfyPage.vueNodes.enterSubgraph()
        await lora.expectNames([
          'A.safetensors',
          'B.safetensors',
          'C.safetensors'
        ])
        await comfyPage.page
          .getByTestId(TestIds.breadcrumb.item('root'))
          .click()
        await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
        await comfyPage.canvasOps.waitForViewToSettle()
        expect(
          await comfyPage.workflow.getExportedWorkflow({ api: true })
        ).toEqual(converted)
        await lora.execute('6.000')
      })

      test('copies populated graphs and edits the copy independently', async ({
        comfyPage,
        lora
      }) => {
        await comfyPage.command.executeCommand('Comfy.Canvas.SelectAll')
        await comfyPage.command.executeCommand('Comfy.Canvas.CopySelected')
        await comfyPage.page.mouse.move(950, 650)
        await comfyPage.command.executeCommand(
          'Comfy.Canvas.PasteFromClipboard'
        )
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(8)
        await comfyPage.command.executeCommand('Comfy.Canvas.SelectAll')
        await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
        await comfyPage.canvasOps.waitForViewToSettle()
        const [, copyRef] =
          await comfyPage.nodeOps.getNodeRefsByType('LoadLoraModel')
        const copy = comfyPage.vueNodes.getNodeLocator(String(copyRef.id))
        await copy
          .getByRole('button', { name: 'Remove LoRA #2', exact: true })
          .click()
        await expect(
          copy.getByRole('group', { name: /^LoRA #\d+$/ })
        ).toHaveCount(2)
        await lora.expectNames([
          'A.safetensors',
          'B.safetensors',
          'C.safetensors'
        ])
        await lora.execute('6.000')
        const [, preview] =
          await comfyPage.nodeOps.getNodeRefsByType('PreviewAny')
        await expect(
          comfyPage.vueNodes
            .getNodeLocator(String(preview.id))
            .getByRole('textbox')
        ).toHaveValue('4.000')
      })

      test('preserves edited rows through removal, Undo/Redo, save and reopen', async ({
        comfyPage,
        lora
      }) => {
        await lora.node
          .getByRole('button', { name: 'Remove LoRA #2', exact: true })
          .click()
        await lora.expectNames(['A.safetensors', 'C.safetensors'])
        await comfyPage.command.executeCommand('Comfy.Undo')
        await lora.expectNames([
          'A.safetensors',
          'B.safetensors',
          'C.safetensors'
        ])
        await comfyPage.command.executeCommand('Comfy.Redo')
        await lora.expectNames(['A.safetensors', 'C.safetensors'])
        await comfyPage.menu.topbar.saveWorkflow('native-lora-rows')
        await comfyPage.menu.topbar.closeWorkflowTab('native-lora-rows')
        await comfyPage.menu.workflowsTab.open()
        await comfyPage.menu.workflowsTab
          .getPersistedItem('native-lora-rows')
          .dblclick()
        await expect
          .poll(() => comfyPage.workflow.getActiveWorkflowPath())
          .toContain('native-lora-rows')
        await comfyPage.menu.workflowsTab.close()
        await lora.expectNames(['A.safetensors', 'C.safetensors'])
        await expect(lora.row(2).getByRole('spinbutton')).toHaveAttribute(
          'aria-valuenow',
          '0.5'
        )
        await lora.execute('4.000')
      })

      test.describe('promoted row', { tag: '@subgraph' }, () => {
        test.beforeEach(async ({ comfyPage, lora }) => {
          const node =
            await comfyPage.vueNodes.getFixtureByTitle('Load LoRA (Model)')
          await comfyPage.contextMenu.openForVueNode(node.header)
          await comfyPage.contextMenu.clickMenuItemExact('Convert to Subgraph')
          await comfyPage.vueNodes.enterSubgraph()
          await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
          await comfyPage.canvasOps.waitForViewToSettle()
          await lora.promoteRow(2)
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
          await comfyPage.canvasOps.waitForViewToSettle()
        })

        test('selects an asset in a promoted row and executes its host values', async ({
          comfyPage,
          lora
        }) => {
          const host = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
          await lora.promotedPicker(host, 2).selectOption('A.safetensors')
          await expect(lora.promotedPicker(host, 2).selection).toHaveText(
            'A.safetensors'
          )
          await host.getByRole('spinbutton').fill('0.2')
          await host.getByRole('spinbutton').blur()
          await lora.execute('4.200')
        })

        test('keeps promotion on the same row when an earlier row is removed', async ({
          comfyPage,
          lora
        }) => {
          const hostId =
            await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
          await comfyPage.vueNodes.enterSubgraph(hostId)
          await lora.node
            .getByRole('button', { name: 'Remove LoRA #1', exact: true })
            .click()
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
          await comfyPage.canvasOps.waitForViewToSettle()
          const host = comfyPage.vueNodes.getNodeLocator(hostId)
          await expect(lora.promotedPicker(host, 1).selection).toHaveText(
            'B.safetensors'
          )
          await expect
            .poll(() => getPromotedWidgetNames(comfyPage, hostId))
            .toEqual([
              'loras.0.lora_name',
              'loras.0.strength',
              'loras.0.enabled'
            ])
          await lora.promotedPicker(host, 1).selectOption('A.safetensors')
          await lora.execute('4.000')
        })

        test('disconnects promotion and removes host widgets when the interior row is deleted', async ({
          comfyPage,
          lora
        }) => {
          const hostId =
            await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
          await comfyPage.vueNodes.enterSubgraph(hostId)
          await expect
            .poll(() => getConnectedInputs(comfyPage, '1', 'loras.'))
            .toHaveLength(3)
          await lora.node
            .getByRole('button', { name: 'Remove LoRA #2', exact: true })
            .click()
          await expect
            .poll(() => getConnectedInputs(comfyPage, '1', 'loras.'))
            .toEqual([])
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
          await comfyPage.canvasOps.waitForViewToSettle()
          await expect
            .poll(() => getPromotedWidgetNames(comfyPage, hostId))
            .toEqual([])
          const host = comfyPage.vueNodes.getNodeLocator(hostId)
          await expect(host.getByRole('spinbutton')).toHaveCount(0)
          await expect(lora.promotedPicker(host, 2).root).toHaveCount(0)
          await lora.execute('4.000')
        })

        test('restores a deleted promoted row with Undo and removes it again with Redo', async ({
          comfyPage,
          lora
        }) => {
          const hostId =
            await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
          const before = await comfyPage.workflow.getExportedWorkflow({
            api: true
          })
          await comfyPage.vueNodes.enterSubgraph(hostId)
          await lora.node
            .getByRole('button', { name: 'Remove LoRA #2', exact: true })
            .click()
          await expect
            .poll(() => getConnectedInputs(comfyPage, '1', 'loras.'))
            .toEqual([])
          await comfyPage.command.executeCommand('Comfy.Undo')
          await expect
            .poll(() => getConnectedInputs(comfyPage, '1', 'loras.'))
            .toHaveLength(3)
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
          await comfyPage.canvasOps.waitForViewToSettle()
          expect(
            await comfyPage.workflow.getExportedWorkflow({ api: true })
          ).toEqual(before)
          await comfyPage.command.executeCommand('Comfy.Redo')
          await expect
            .poll(() => getPromotedWidgetNames(comfyPage, hostId))
            .toEqual([])
          await comfyPage.workflow.waitForDraftPersisted()
          await comfyPage.workflow.reloadAndWaitForApp()
          await lora.execute('4.000')
        })

        test('copies subgraph hosts without mixing their promoted values', async ({
          comfyPage,
          lora
        }) => {
          const originalId =
            await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
          await comfyPage.command.executeCommand('Comfy.Canvas.SelectAll')
          await comfyPage.command.executeCommand('Comfy.Canvas.CopySelected')
          await comfyPage.page.mouse.move(950, 650)
          await comfyPage.command.executeCommand(
            'Comfy.Canvas.PasteFromClipboard'
          )
          await expect
            .poll(() => comfyPage.nodeOps.getGraphNodesCount())
            .toBe(8)
          await comfyPage.command.executeCommand('Comfy.Canvas.SelectAll')
          await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
          await comfyPage.canvasOps.waitForViewToSettle()
          const [originalRef, copyRef] =
            await comfyPage.nodeOps.getNodeRefsByTitle('New Subgraph')
          expect(await copyRef.getType()).not.toBe(await originalRef.getType())
          const original = comfyPage.vueNodes.getNodeLocator(originalId)
          const copy = comfyPage.vueNodes.getNodeLocator(String(copyRef.id))
          await lora.promotedPicker(copy, 2).selectOption('A.safetensors')
          await copy.getByRole('spinbutton').fill('0.2')
          await copy.getByRole('spinbutton').blur()
          await expect(lora.promotedPicker(original, 2).selection).toHaveText(
            'B.safetensors'
          )
          await comfyPage.workflow.waitForDraftPersisted()
          await comfyPage.workflow.reloadAndWaitForApp()
          await lora.execute('6.000')
          const [, preview] =
            await comfyPage.nodeOps.getNodeRefsByType('PreviewAny')
          await expect(
            comfyPage.vueNodes
              .getNodeLocator(String(preview.id))
              .getByRole('textbox')
          ).toHaveValue('4.200')
        })

        test('restores a promoted draft at root then enters its subgraph', async ({
          comfyPage,
          lora
        }) => {
          const hostId =
            await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
          const before = await comfyPage.workflow.getExportedWorkflow({
            api: true
          })
          await comfyPage.workflow.waitForDraftPersisted()
          await comfyPage.workflow.reloadAndWaitForApp()
          await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
          expect(
            await comfyPage.workflow.getExportedWorkflow({ api: true })
          ).toEqual(before)
          await comfyPage.vueNodes.enterSubgraph(hostId)
          await expect(lora.picker(1).selection).toHaveText('A.safetensors')
          await expect(lora.picker(3).selection).toHaveText('C.safetensors')
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
          await comfyPage.canvasOps.waitForViewToSettle()
          await expect(
            lora.promotedPicker(comfyPage.vueNodes.getNodeLocator(hostId), 2)
              .selection
          ).toHaveText('B.safetensors')
          await lora.execute('6.000')
        })

        test('restores a promoted draft directly inside its subgraph', async ({
          comfyPage,
          lora
        }) => {
          const hostId =
            await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
          const before = await comfyPage.workflow.getExportedWorkflow({
            api: true
          })
          await comfyPage.vueNodes.enterSubgraph(hostId)
          await comfyPage.workflow.waitForDraftPersisted()
          await comfyPage.workflow.reloadAndWaitForApp()
          await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)
          expect(
            await comfyPage.workflow.getExportedWorkflow({ api: true })
          ).toEqual(before)
          await expect(lora.picker(1).selection).toHaveText('A.safetensors')
          await expect(lora.picker(3).selection).toHaveText('C.safetensors')
          await comfyPage.page
            .getByTestId(TestIds.breadcrumb.item('root'))
            .click()
          await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
          await comfyPage.canvasOps.waitForViewToSettle()
          await expect(
            lora.promotedPicker(comfyPage.vueNodes.getNodeLocator(hostId), 2)
              .selection
          ).toHaveText('B.safetensors')
          await lora.execute('6.000')
        })

        test.describe('two-level promotion', () => {
          test.beforeEach(async ({ comfyPage }) => {
            const host =
              await comfyPage.vueNodes.getFixtureByTitle('New Subgraph')
            await comfyPage.contextMenu.openForVueNode(host.header)
            await comfyPage.contextMenu.clickMenuItemExact(
              'Convert to Subgraph'
            )
            await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
            await comfyPage.canvasOps.waitForViewToSettle()
            await comfyPage.vueNodes.enterSubgraph()
            await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
            await comfyPage.canvasOps.waitForViewToSettle()
            for (const field of ['lora_name', 'strength', 'enabled']) {
              const row = comfyPage.vueNodes.getWidgetRowByLabel(
                'New Subgraph',
                `LoRA #2 ${field}`
              )
              await comfyPage.contextMenu.openFor(
                row.getByText(`LoRA #2 ${field}`, { exact: true })
              )
              await comfyPage.contextMenu.clickMenuItemExact(
                `Promote Widget: LoRA #2 ${field}`
              )
            }
            await comfyPage.page
              .getByTestId(TestIds.breadcrumb.item('root'))
              .click()
            await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
            await comfyPage.canvasOps.waitForViewToSettle()
          })

          test('executes top-level asset edits across two boundaries after draft reload', async ({
            comfyPage,
            lora
          }) => {
            const host = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
            await lora.promotedPicker(host, 2).selectOption('A.safetensors')
            await host.getByRole('spinbutton').fill('0.2')
            await host.getByRole('spinbutton').blur()
            await comfyPage.workflow.waitForDraftPersisted()
            await comfyPage.workflow.reloadAndWaitForApp()
            await expect(lora.promotedPicker(host, 2).selection).toHaveText(
              'A.safetensors'
            )
            await lora.execute('4.200')
          })

          test('persists a two-level promoted toggle edited after draft reload', async ({
            comfyPage,
            lora
          }) => {
            await comfyPage.workflow.waitForDraftPersisted()
            await comfyPage.workflow.reloadAndWaitForApp()
            const host = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
            const before = await comfyPage.workflow.getExportedWorkflow({
              api: true
            })
            await host.getByRole('switch').uncheck()
            const prompt = await comfyPage.workflow.getExportedWorkflow({
              api: true
            })
            const loader = Object.values(prompt).find(
              (node) => node.class_type === 'LoadLoraModel'
            )
            expect(loader?.inputs['loras.1.enabled']).toBe(false)
            await comfyPage.workflow.waitForDraftPersisted()
            await comfyPage.workflow.reloadAndWaitForApp()
            await expect(host.getByRole('switch')).not.toBeChecked()
            expect(
              await comfyPage.workflow.getExportedWorkflow({ api: true })
            ).toEqual(prompt)
            await lora.execute('4.000')
            await host.getByRole('switch').check()
            expect(
              await comfyPage.workflow.getExportedWorkflow({ api: true })
            ).toEqual(before)
            await lora.execute('6.000')
          })

          test('keeps top-level edits on the same row after reindexing across two boundaries', async ({
            comfyPage,
            lora
          }) => {
            const outerId =
              await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
            await comfyPage.vueNodes.enterSubgraph(outerId)
            await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
            await comfyPage.canvasOps.waitForViewToSettle()
            await comfyPage.vueNodes.enterSubgraph()
            await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
            await comfyPage.canvasOps.waitForViewToSettle()
            await lora.node
              .getByRole('button', { name: 'Remove LoRA #1', exact: true })
              .click()
            await comfyPage.page
              .getByTestId(TestIds.breadcrumb.item('root'))
              .click()
            await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
            await comfyPage.canvasOps.waitForViewToSettle()
            const host = comfyPage.vueNodes.getNodeLocator(outerId)
            await expect(lora.promotedPicker(host, 1).selection).toHaveText(
              'B.safetensors'
            )
            await lora.promotedPicker(host, 1).selectOption('A.safetensors')
            await host.getByRole('spinbutton').fill('0.2')
            await host.getByRole('spinbutton').blur()
            await comfyPage.workflow.waitForDraftPersisted()
            await comfyPage.workflow.reloadAndWaitForApp()
            await lora.execute('3.200')
          })

          test('removes the top widget and intermediate links when the interior row is deleted', async ({
            comfyPage,
            lora
          }) => {
            const outerId =
              await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
            await comfyPage.vueNodes.enterSubgraph(outerId)
            await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
            await comfyPage.canvasOps.waitForViewToSettle()
            const innerId =
              await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
            await comfyPage.vueNodes.enterSubgraph(innerId)
            await lora.node
              .getByRole('button', { name: 'Remove LoRA #2', exact: true })
              .click()
            await expect
              .poll(() => getConnectedInputs(comfyPage, '1', 'loras.'))
              .toEqual([])
            await comfyPage.page
              .getByTestId(TestIds.breadcrumb.item('root'))
              .click()
            await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
            await comfyPage.canvasOps.waitForViewToSettle()
            await expect
              .poll(() => getPromotedWidgetNames(comfyPage, outerId))
              .toEqual([])
            const host = comfyPage.vueNodes.getNodeLocator(outerId)
            await expect(lora.promotedPicker(host, 2).root).toHaveCount(0)
            await expect(host.getByRole('spinbutton')).toHaveCount(0)
            await comfyPage.vueNodes.enterSubgraph(outerId)
            await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
            await comfyPage.canvasOps.waitForViewToSettle()
            await expect
              .poll(() => getPromotedWidgetNames(comfyPage, innerId))
              .toEqual([])
            await expect
              .poll(() => comfyPage.subgraph.getDefinitionInventory())
              .toEqual([
                { name: 'New Subgraph', nodes: 1, links: 2 },
                { name: 'New Subgraph', nodes: 1, links: 2 }
              ])
            await comfyPage.page
              .getByTestId(TestIds.breadcrumb.item('root'))
              .click()
            await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
            await comfyPage.canvasOps.waitForViewToSettle()
            await lora.execute('4.000')
          })
        })
      })
    })

    test('compacts sparse API rows without changing filenames or strengths', async ({
      comfyPage,
      lora
    }) => {
      await comfyPage.workflow.loadWorkflow('inputs/native_lora_sparse_api')
      await lora.expectNames(['A.safetensors', 'C.safetensors'])
      const prompt = await comfyPage.workflow.getExportedWorkflow({ api: true })
      expect(prompt['1'].inputs).toEqual({
        model: ['3', 0],
        'loras.0.lora_name': 'native-lora-e2e/A.safetensors',
        'loras.0.strength': 1,
        'loras.0.enabled': true,
        'loras.1.lora_name': 'native-lora-e2e/C.safetensors',
        'loras.1.strength': 0.5,
        'loras.1.enabled': true
      })
      await lora.execute('4.000')
    })

    test('restores 21 API rows and blocks execution until the count is within the native limit', async ({
      comfyPage,
      lora
    }) => {
      await comfyPage.workflow.loadWorkflow('inputs/native_lora_over_limit_api')
      await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
      await comfyPage.canvasOps.waitForViewToSettle()
      await expect(
        lora.node.getByRole('group', { name: /^LoRA #\d+$/ })
      ).toHaveCount(21)
      const add = lora.node.getByRole('button', { name: 'Add LoRA' })
      await expect(add).toBeDisabled()
      const queued = comfyPage.page.waitForResponse('**/api/prompt')
      await comfyPage.command.executeCommand('Comfy.QueuePrompt')
      const response = await queued
      expect(response.status()).toBe(400)
      expect(await response.text()).toContain('max=20')
      const dialog = comfyPage.page.getByRole('dialog')
      await expect(
        dialog.getByRole('heading', { name: 'Prompt validation failed' })
      ).toBeVisible()
      await comfyPage.toast.closeToasts()
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      await lora.node
        .getByRole('button', { name: 'Remove LoRA #1', exact: true })
        .click()
      await expect(add).toBeDisabled()
      await lora.node
        .getByRole('button', { name: 'Remove LoRA #1', exact: true })
        .click()
      await expect(add).toBeEnabled()
      await expect(
        lora.node.getByRole('group', { name: /^LoRA #\d+$/ })
      ).toHaveCount(19)
      await lora.execute('20.000')
    })
  }
)
