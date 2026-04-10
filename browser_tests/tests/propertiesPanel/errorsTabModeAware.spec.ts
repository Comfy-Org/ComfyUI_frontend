import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  cleanupFakeModel,
  openErrorsTab,
  loadWorkflowAndOpenErrorsTab
} from '@e2e/tests/propertiesPanel/ErrorsTabHelper'

test.describe('Errors tab - Mode-aware errors', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
  })

  test.describe('Missing nodes', () => {
    test('Deleting a missing node removes its error from the errors tab', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_nodes')

      const missingNodeGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingNodePacksGroup
      )
      await expect(missingNodeGroup).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.delete()

      await expect(missingNodeGroup).not.toBeVisible()
    })

    test('Undo after bypass restores error without showing overlay', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_nodes')

      const missingNodeGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingNodePacksGroup
      )
      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(missingNodeGroup).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingNodeGroup).not.toBeVisible()

      await comfyPage.keyboard.undo()
      await expect.poll(() => node.isBypassed()).toBeFalsy()
      await expect(errorOverlay).not.toBeVisible()
      await openErrorsTab(comfyPage)
      await expect(missingNodeGroup).toBeVisible()

      await comfyPage.keyboard.redo()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingNodeGroup).not.toBeVisible()
    })
  })

  test.describe('Missing models', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await cleanupFakeModel(comfyPage)
    })

    test.afterEach(async ({ comfyPage }) => {
      await cleanupFakeModel(comfyPage)
    })

    test('Loading a workflow with all nodes bypassed shows no errors', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_models_bypassed')

      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(errorOverlay).not.toBeVisible()

      await comfyPage.actionbar.propertiesButton.click()
      await expect(
        comfyPage.page.getByTestId(TestIds.propertiesPanel.errorsTab)
      ).not.toBeVisible()
    })

    test('Bypassing a node hides its error, un-bypassing restores it', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingModelsGroup
      )
      await expect(missingModelGroup).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingModelGroup).not.toBeVisible()

      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeFalsy()
      await openErrorsTab(comfyPage)
      await expect(missingModelGroup).toBeVisible()
    })

    test('Pasting a node with missing model increases referencing node count', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingModelsGroup
      )
      await expect(missingModelGroup).toBeVisible()
      await expect(missingModelGroup).toContainText(
        /fake_model\.safetensors\s*\(1\)/
      )

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.click('title')
      await comfyPage.clipboard.copy()
      await comfyPage.clipboard.paste()

      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(2)

      await comfyPage.canvas.click()
      await expect(missingModelGroup).toContainText(
        /fake_model\.safetensors\s*\(2\)/
      )
    })

    test('Pasting a bypassed node does not add a new error', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingModelsGroup
      )

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingModelGroup).not.toBeVisible()

      await comfyPage.clipboard.copy()
      await comfyPage.clipboard.paste()

      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(2)
      await expect(missingModelGroup).not.toBeVisible()
    })

    test('Deleting a node with missing model removes its error', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingModelsGroup
      )
      await expect(missingModelGroup).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.delete()

      await expect(missingModelGroup).not.toBeVisible()
    })

    test('Undo after bypass restores error without showing overlay', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingModelsGroup
      )
      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(missingModelGroup).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingModelGroup).not.toBeVisible()

      await comfyPage.keyboard.undo()
      await expect.poll(() => node.isBypassed()).toBeFalsy()
      await expect(errorOverlay).not.toBeVisible()
      await openErrorsTab(comfyPage)
      await expect(missingModelGroup).toBeVisible()

      await comfyPage.keyboard.redo()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingModelGroup).not.toBeVisible()
    })

    test('Selecting a node filters errors tab to only that node', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_models_with_nodes'
      )

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingModelsGroup
      )
      await expect(missingModelGroup).toContainText(/\(2\)/)

      const node1 = await comfyPage.nodeOps.getNodeRefById('1')
      await node1.click('title')
      await expect(missingModelGroup).toContainText(/\(1\)/)

      await comfyPage.canvas.click()
      await expect(missingModelGroup).toContainText(/\(2\)/)
    })
  })

  test.describe('Missing media', () => {
    test('Loading a workflow with all nodes bypassed shows no errors', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_media_bypassed')

      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(errorOverlay).not.toBeVisible()

      await comfyPage.actionbar.propertiesButton.click()
      await expect(
        comfyPage.page.getByTestId(TestIds.propertiesPanel.errorsTab)
      ).not.toBeVisible()
    })

    test('Bypassing a node hides its error, un-bypassing restores it', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_media_single'
      )

      const missingMediaGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingMediaGroup
      )
      await expect(missingMediaGroup).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('10')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingMediaGroup).not.toBeVisible()

      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeFalsy()
      await openErrorsTab(comfyPage)
      await expect(missingMediaGroup).toBeVisible()
    })

    test('Pasting a bypassed node does not add a new error', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_media_single'
      )

      const missingMediaGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingMediaGroup
      )

      const node = await comfyPage.nodeOps.getNodeRefById('10')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingMediaGroup).not.toBeVisible()

      await comfyPage.clipboard.copy()
      await comfyPage.clipboard.paste()

      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(2)
      await expect(missingMediaGroup).not.toBeVisible()
    })

    test('Selecting a node filters errors tab to only that node', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_media_multiple')

      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(errorOverlay).toBeVisible()
      await errorOverlay
        .getByTestId(TestIds.dialogs.errorOverlayDismiss)
        .click()

      const mediaRows = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingMediaRow
      )

      await openErrorsTab(comfyPage)
      await expect(mediaRows).toHaveCount(2)

      const node = await comfyPage.nodeOps.getNodeRefById('10')
      await node.click('title')
      await expect(mediaRows).toHaveCount(1)

      await comfyPage.canvas.click({ position: { x: 400, y: 600 } })
      await expect(mediaRows).toHaveCount(2)
    })
  })

  test.describe('Subgraph', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await cleanupFakeModel(comfyPage)
    })

    test.afterEach(async ({ comfyPage }) => {
      await cleanupFakeModel(comfyPage)
    })

    test('Bypassing a subgraph hides interior errors, un-bypassing restores them', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'missing/missing_models_in_subgraph'
      )

      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(errorOverlay).toBeVisible()
      await errorOverlay
        .getByTestId(TestIds.dialogs.errorOverlayDismiss)
        .click()

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingModelsGroup
      )

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      const errorsTab = comfyPage.page.getByTestId(
        TestIds.propertiesPanel.errorsTab
      )

      await comfyPage.keyboard.selectAll()
      await comfyPage.keyboard.bypass()
      await expect.poll(() => subgraphNode.isBypassed()).toBeTruthy()

      await comfyPage.actionbar.propertiesButton.click()
      await expect(errorsTab).not.toBeVisible()

      await comfyPage.keyboard.selectAll()
      await comfyPage.keyboard.bypass()
      await expect.poll(() => subgraphNode.isBypassed()).toBeFalsy()
      await openErrorsTab(comfyPage)
      await expect(missingModelGroup).toBeVisible()
    })

    test('Bypassing a node inside a subgraph hides its error, un-bypassing restores it', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'missing/missing_models_in_subgraph'
      )

      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(errorOverlay).toBeVisible()
      await errorOverlay
        .getByTestId(TestIds.dialogs.errorOverlayDismiss)
        .click()

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingModelsGroup
      )

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      await comfyPage.keyboard.selectAll()
      await comfyPage.keyboard.bypass()

      const errorsTab = comfyPage.page.getByTestId(
        TestIds.propertiesPanel.errorsTab
      )
      await comfyPage.actionbar.propertiesButton.click()
      await expect(errorsTab).not.toBeVisible()

      await comfyPage.keyboard.selectAll()
      await comfyPage.keyboard.bypass()
      await openErrorsTab(comfyPage)
      await expect(missingModelGroup).toBeVisible()
    })
  })

  test.describe('Workflow switching', () => {
    test('Does not resurface error overlay when switching back to workflow with missing nodes', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(errorOverlay).toBeVisible()

      await errorOverlay
        .getByTestId(TestIds.dialogs.errorOverlayDismiss)
        .click()
      await expect(errorOverlay).not.toBeVisible()

      await comfyPage.menu.workflowsTab.open()
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')

      await comfyPage.menu.workflowsTab.switchToWorkflow('missing_nodes')

      await expect(errorOverlay).not.toBeVisible()
    })

    test('Restores missing nodes in errors tab when switching back to workflow', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(errorOverlay).toBeVisible()
      await errorOverlay
        .getByTestId(TestIds.dialogs.errorOverlayDismiss)
        .click()

      const missingNodeGroup = comfyPage.page.getByTestId(
        TestIds.errorsTab.missingNodePacksGroup
      )

      await openErrorsTab(comfyPage)
      await expect(missingNodeGroup).toBeVisible()

      await comfyPage.menu.workflowsTab.open()
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await expect(missingNodeGroup).not.toBeVisible()

      await comfyPage.menu.workflowsTab.switchToWorkflow('missing_nodes')
      await openErrorsTab(comfyPage)
      await expect(missingNodeGroup).toBeVisible()
    })
  })
})
