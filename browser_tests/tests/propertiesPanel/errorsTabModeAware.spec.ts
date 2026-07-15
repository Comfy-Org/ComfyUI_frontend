import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  cleanupFakeModel,
  openErrorsTab,
  loadWorkflowAndOpenErrorsTab
} from '@e2e/fixtures/helpers/ErrorsTabHelper'
import {
  appendComboInputOptions,
  routeObjectInfoFromSetupApi
} from '@e2e/fixtures/utils/objectInfo'
import {
  NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
  expectMissingModelReferenceCount,
  expectNoMissingModelUi,
  expectResolvedPromotedModelSuppressesStaleInteriorErrors,
  expectSingleMissingModelReference,
  getMissingModelLabel,
  loadPromotedMissingModelAndOpenErrorsTab,
  loadPromotedMissingModelWithHostValuesAndOpenErrorsTab,
  selectSectionComboPromotedModel,
  selectVueComboPromotedModelByTitle,
  setLegacyPromotedComboModel
} from '@e2e/fixtures/utils/promotedMissingModel'

const FAKE_MODEL_NAME = 'fake_model.safetensors'
const RESOLVED_PROMOTED_MODEL_NAME = 'resolved_model.safetensors'

const promotedModelTest = test.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) =>
        appendComboInputOptions(
          objectInfo,
          'CheckpointLoaderSimple',
          'ckpt_name',
          [RESOLVED_PROMOTED_MODEL_NAME]
        )
    )
    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

async function expectReferenceBadge(group: Locator, count: number) {
  await expect(
    group.getByTestId(TestIds.dialogs.missingModelReferenceCount)
  ).toHaveText(String(count))
}

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
        TestIds.dialogs.missingNodePacksGroup
      )
      await expect(missingNodeGroup).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.delete()

      await expect(missingNodeGroup).toBeHidden()
    })

    test('Undo after bypass restores error without showing overlay', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_nodes')

      const missingNodeGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingNodePacksGroup
      )
      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(missingNodeGroup).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingNodeGroup).toBeHidden()

      await comfyPage.keyboard.undo()
      await expect.poll(() => node.isBypassed()).toBeFalsy()
      await expect(errorOverlay).toBeHidden()
      await openErrorsTab(comfyPage)
      await expect(missingNodeGroup).toBeVisible()

      await comfyPage.keyboard.redo()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingNodeGroup).toBeHidden()
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
      await expect(errorOverlay).toBeHidden()

      await comfyPage.actionbar.propertiesButton.click()
      await expect(
        comfyPage.page.getByTestId(TestIds.propertiesPanel.errorsTab)
      ).toBeHidden()
    })

    test('Bypassing a node hides its error, un-bypassing restores it', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelsGroup
      )
      await expect(missingModelGroup).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingModelGroup).toBeHidden()

      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeFalsy()
      await openErrorsTab(comfyPage)
      await expect(missingModelGroup).toBeVisible()
    })

    test('Bypass/un-bypass cycle preserves Copy URL button on the restored row', async ({
      comfyPage
    }) => {
      // Regression: on un-bypass, the realtime scan produced a fresh
      // candidate without url/hash/directory — those fields were only
      // attached by the full pipeline's enrichWithEmbeddedMetadata. The
      // row's Copy URL button (v-if gated on representative.url) then
      // disappeared. Per-node scan now enriches from node.properties.models
      // which persists across mode toggles. Uses the `_from_node_properties`
      // fixture because the enrichment source is per-node metadata, not
      // the workflow-level `models[]` array (which the realtime scan
      // path does not see).
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_models_from_node_properties'
      )

      const copyUrlButton = comfyPage.page.getByRole('button', {
        name: 'Copy URL'
      })
      await expect(copyUrlButton.first()).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()

      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeFalsy()
      await openErrorsTab(comfyPage)
      await expect(copyUrlButton.first()).toBeVisible()
    })

    test('Pasting a node with missing model increases referencing node count', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelsGroup
      )
      await expect(missingModelGroup).toBeVisible()
      await expect(
        getMissingModelLabel(missingModelGroup, FAKE_MODEL_NAME)
      ).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.click('title')
      await comfyPage.clipboard.copy()
      await comfyPage.clipboard.paste()

      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(2)

      await comfyPage.canvas.click()
      await expectReferenceBadge(missingModelGroup, 2)
    })

    test('Pasting a bypassed node does not add a new error', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelsGroup
      )

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingModelGroup).toBeHidden()

      await comfyPage.clipboard.copy()
      await comfyPage.clipboard.paste()

      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(2)
      await expect(missingModelGroup).toBeHidden()
    })

    test('Deleting a node with missing model removes its error', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelsGroup
      )
      await expect(missingModelGroup).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.delete()

      await expect(missingModelGroup).toBeHidden()
    })

    test('Undo after bypass restores error without showing overlay', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(comfyPage, 'missing/missing_models')

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelsGroup
      )
      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(missingModelGroup).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingModelGroup).toBeHidden()

      await comfyPage.keyboard.undo()
      await expect.poll(() => node.isBypassed()).toBeFalsy()
      await expect(errorOverlay).toBeHidden()
      await openErrorsTab(comfyPage)
      await expect(missingModelGroup).toBeVisible()

      await comfyPage.keyboard.redo()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingModelGroup).toBeHidden()
    })

    test('Selecting a node keeps all errors visible and shows selection context', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_models_with_nodes'
      )

      const missingModelGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingModelsGroup
      )
      await expectReferenceBadge(missingModelGroup, 2)

      const node1 = await comfyPage.nodeOps.getNodeRefById('1')
      await node1.click('title')

      await expect(
        getMissingModelLabel(missingModelGroup, FAKE_MODEL_NAME)
      ).toBeVisible()
      await expectReferenceBadge(missingModelGroup, 2)
      const strip = comfyPage.page.getByTestId(
        TestIds.propertiesPanel.selectionContextStrip
      )
      await expect(strip).toBeVisible()
      await expect(
        strip,
        'The strip count is scoped to the selection, diverging from the global reference badge'
      ).toContainText('1 error')

      await comfyPage.canvas.click()
      await expect(
        strip,
        'Deselecting swaps the always-visible strip back to the summary'
      ).toContainText('2 nodes — 1 error')
      await expectReferenceBadge(missingModelGroup, 2)
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
      await expect(errorOverlay).toBeHidden()

      await comfyPage.actionbar.propertiesButton.click()
      await expect(
        comfyPage.page.getByTestId(TestIds.propertiesPanel.errorsTab)
      ).toBeHidden()
    })

    test('Bypassing a node hides its error, un-bypassing restores it', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_media_single'
      )

      const missingMediaGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingMediaGroup
      )
      await expect(missingMediaGroup).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById('10')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingMediaGroup).toBeHidden()

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
        TestIds.dialogs.missingMediaGroup
      )

      const node = await comfyPage.nodeOps.getNodeRefById('10')
      await node.click('title')
      await comfyPage.keyboard.bypass()
      await expect.poll(() => node.isBypassed()).toBeTruthy()
      await expect(missingMediaGroup).toBeHidden()

      await comfyPage.clipboard.copy()
      await comfyPage.clipboard.paste()

      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(2)
      await expect(missingMediaGroup).toBeHidden()
    })

    test('Selecting a node keeps all media rows visible and shows selection context', async ({
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
        TestIds.dialogs.missingMediaRow
      )

      await openErrorsTab(comfyPage)
      await expect(mediaRows).toHaveCount(2)

      const node = await comfyPage.nodeOps.getNodeRefById('10')
      await node.click('title')

      // Selection no longer filters the list — rows stay global and the
      // selection is surfaced via the context strip instead.
      const strip = comfyPage.page.getByTestId(
        TestIds.propertiesPanel.selectionContextStrip
      )
      await expect(strip).toBeVisible()
      await expect(strip).toContainText('1 error')
      await expect(mediaRows).toHaveCount(2)

      await comfyPage.canvas.click({ position: { x: 400, y: 600 } })
      // Deselecting swaps the always-visible strip back to the summary
      await expect(strip).toContainText('2 nodes — 2 errors')
      await expect(mediaRows).toHaveCount(2)
    })
  })

  test.describe('Selection emphasis', () => {
    test('Selecting a node collapses unrelated groups and highlights its rows', async ({
      comfyPage
    }) => {
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/missing_nodes_and_media'
      )

      const missingNodeCard = comfyPage.page.getByTestId(
        TestIds.dialogs.missingNodeCard
      )
      const mediaRow = comfyPage.page.getByTestId(
        TestIds.dialogs.missingMediaRow
      )
      const strip = comfyPage.page.getByTestId(
        TestIds.propertiesPanel.selectionContextStrip
      )
      await expect(missingNodeCard).toBeVisible()
      await expect(mediaRow).toBeVisible()
      await expect(strip).toContainText('2 nodes — 2 errors')

      const mediaNode = await comfyPage.nodeOps.getNodeRefById('10')
      // The node sits near the canvas top where overlays intercept clicks
      await mediaNode.centerOnNode()
      await mediaNode.click('title')

      // The unrelated missing-node group auto-collapses while the matched
      // media row stays visible and is marked as part of the selection
      await expect(missingNodeCard).toBeHidden()
      await expect(mediaRow).toBeVisible()
      await expect(mediaRow).toHaveAttribute('aria-current', 'true')
      await expect(strip).toContainText('1 error')

      await comfyPage.canvas.click({ position: { x: 400, y: 600 } })
      // Emphasis ends: the collapsed group re-expands and the strip
      // returns to the workflow summary
      await expect(missingNodeCard).toBeVisible()
      await expect(mediaRow).not.toHaveAttribute('aria-current', 'true')
      await expect(strip).toContainText('2 nodes — 2 errors')
    })
  })

  test.describe('Subgraph', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await cleanupFakeModel(comfyPage)
    })

    test.afterEach(async ({ comfyPage }) => {
      await cleanupFakeModel(comfyPage)
    })

    promotedModelTest(
      'Changing an OSS Vue promoted model clears a nested subgraph error',
      { tag: ['@vue-nodes', '@widget', '@subgraph'] },
      async ({ comfyPage }) => {
        let missingModelGroup: Locator

        await test.step('A: shared-definition active host reports the missing model', async () => {
          missingModelGroup = await loadPromotedMissingModelAndOpenErrorsTab(
            comfyPage,
            NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
            FAKE_MODEL_NAME
          )
        })

        await test.step('B: bypassing the resolved sibling host keeps the active host error visible', async () => {
          const siblingHostNodeId =
            NESTED_PROMOTED_MISSING_MODEL_WORKFLOW.sharedDefinitionSiblingHostNodeId
          if (siblingHostNodeId === undefined) {
            throw new Error('Expected a shared-definition sibling host')
          }

          const siblingHost =
            await comfyPage.nodeOps.getNodeRefById(siblingHostNodeId)
          await siblingHost.centerOnNode()
          await siblingHost.click('title')
          await comfyPage.keyboard.bypass()
          await expect.poll(() => siblingHost.isBypassed()).toBeTruthy()
          await comfyPage.canvas.click({ position: { x: 700, y: 650 } })
          await openErrorsTab(comfyPage)
          await expectSingleMissingModelReference(
            missingModelGroup,
            FAKE_MODEL_NAME
          )
        })

        await test.step('C: changing the active host promoted widget resolves the model', async () => {
          const activeHost = await comfyPage.nodeOps.getNodeRefById(
            NESTED_PROMOTED_MISSING_MODEL_WORKFLOW.hostNodeId
          )
          await activeHost.centerOnNode()
          await selectVueComboPromotedModelByTitle(
            comfyPage,
            NESTED_PROMOTED_MISSING_MODEL_WORKFLOW.hostNodeTitle,
            RESOLVED_PROMOTED_MODEL_NAME
          )
        })

        await test.step('D: the missing model UI clears', async () => {
          await expectNoMissingModelUi(comfyPage)
        })

        await test.step('E: two missing shared-definition hosts report two references', async () => {
          const siblingHostNodeId =
            NESTED_PROMOTED_MISSING_MODEL_WORKFLOW.sharedDefinitionSiblingHostNodeId
          if (siblingHostNodeId === undefined) {
            throw new Error('Expected a shared-definition sibling host')
          }

          missingModelGroup =
            await loadPromotedMissingModelWithHostValuesAndOpenErrorsTab(
              comfyPage,
              NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
              {
                [siblingHostNodeId]: FAKE_MODEL_NAME,
                [NESTED_PROMOTED_MISSING_MODEL_WORKFLOW.hostNodeId]:
                  FAKE_MODEL_NAME
              },
              FAKE_MODEL_NAME,
              2
            )
        })

        await test.step('F: changing one missing host leaves the other missing reference', async () => {
          await selectVueComboPromotedModelByTitle(
            comfyPage,
            NESTED_PROMOTED_MISSING_MODEL_WORKFLOW.hostNodeTitle,
            RESOLVED_PROMOTED_MODEL_NAME
          )
          await expectMissingModelReferenceCount(
            missingModelGroup,
            FAKE_MODEL_NAME,
            1
          )
        })

        await test.step('G: changing the remaining missing host clears the model error', async () => {
          const siblingHostTitle =
            NESTED_PROMOTED_MISSING_MODEL_WORKFLOW.sharedDefinitionSiblingHostNodeTitle
          if (siblingHostTitle === undefined) {
            throw new Error('Expected a shared-definition sibling host title')
          }

          await selectVueComboPromotedModelByTitle(
            comfyPage,
            siblingHostTitle,
            RESOLVED_PROMOTED_MODEL_NAME
          )
          await expectNoMissingModelUi(comfyPage)
        })
      }
    )

    promotedModelTest(
      'Changing an OSS Vue promoted model from the Parameters tab clears a nested subgraph error',
      { tag: ['@vue-nodes', '@widget', '@subgraph'] },
      async ({ comfyPage }) => {
        await loadPromotedMissingModelAndOpenErrorsTab(
          comfyPage,
          NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
          FAKE_MODEL_NAME
        )

        await selectSectionComboPromotedModel(
          comfyPage,
          NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
          RESOLVED_PROMOTED_MODEL_NAME
        )

        await expectNoMissingModelUi(comfyPage)
      }
    )

    promotedModelTest(
      'Changing an OSS legacy promoted model clears a nested subgraph error',
      { tag: ['@canvas', '@widget', '@subgraph'] },
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
        await loadPromotedMissingModelAndOpenErrorsTab(
          comfyPage,
          NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
          FAKE_MODEL_NAME
        )

        await setLegacyPromotedComboModel(
          comfyPage,
          NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
          RESOLVED_PROMOTED_MODEL_NAME
        )

        await expectNoMissingModelUi(comfyPage)
      }
    )

    promotedModelTest(
      'Refreshing a resolved promoted missing model clears the combo invalid state',
      { tag: ['@widget', '@subgraph'] },
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await loadWorkflowAndOpenErrorsTab(
          comfyPage,
          NESTED_PROMOTED_MISSING_MODEL_WORKFLOW.workflowName
        )
        await comfyPage.vueNodes.waitForNodes()

        const missingModelGroup = comfyPage.page.getByTestId(
          TestIds.dialogs.missingModelsGroup
        )
        await expect(
          getMissingModelLabel(missingModelGroup, FAKE_MODEL_NAME)
        ).toBeVisible()

        const promotedModelCombo = comfyPage.vueNodes
          .getNodeByTitle(NESTED_PROMOTED_MISSING_MODEL_WORKFLOW.hostNodeTitle)
          .getByRole('combobox', { name: 'ckpt_name', exact: true })
        await expect(promotedModelCombo).toHaveAttribute('aria-invalid', 'true')

        const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
          comfyPage.page,
          (objectInfo) =>
            appendComboInputOptions(
              objectInfo,
              'CheckpointLoaderSimple',
              'ckpt_name',
              [FAKE_MODEL_NAME, RESOLVED_PROMOTED_MODEL_NAME]
            )
        )

        try {
          await comfyPage.page
            .getByTestId(TestIds.dialogs.missingModelRefresh)
            .click()

          await expect(missingModelGroup).toBeHidden()
          await expect(promotedModelCombo).toBeVisible()
          await expect(promotedModelCombo).not.toHaveAttribute(
            'aria-invalid',
            'true'
          )
        } finally {
          await unrouteObjectInfo()
        }
      }
    )

    promotedModelTest(
      'Reloading a resolved nested promoted model ignores stale interior values',
      { tag: ['@vue-nodes', '@widget', '@subgraph'] },
      async ({ comfyPage }) => {
        await expectResolvedPromotedModelSuppressesStaleInteriorErrors(
          comfyPage,
          NESTED_PROMOTED_MISSING_MODEL_WORKFLOW,
          [
            {
              subgraphNodeIdToEnter: '4',
              nodeTitle: 'Inner Subgraph with Promoted Missing Model'
            },
            { subgraphNodeIdToEnter: '2', nodeTitle: 'Load Checkpoint' }
          ],
          RESOLVED_PROMOTED_MODEL_NAME,
          FAKE_MODEL_NAME
        )
      }
    )

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
        TestIds.dialogs.missingModelsGroup
      )

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      const errorsTab = comfyPage.page.getByTestId(
        TestIds.propertiesPanel.errorsTab
      )

      await comfyPage.keyboard.selectAll()
      await comfyPage.keyboard.bypass()
      await expect.poll(() => subgraphNode.isBypassed()).toBeTruthy()

      await comfyPage.actionbar.propertiesButton.click()
      await expect(errorsTab).toBeHidden()

      await comfyPage.keyboard.selectAll()
      await comfyPage.keyboard.bypass()
      await expect.poll(() => subgraphNode.isBypassed()).toBeFalsy()
      await openErrorsTab(comfyPage)
      await expect(missingModelGroup).toBeVisible()
    })

    test('Deleting a node inside a subgraph removes its missing model error', async ({
      comfyPage
    }) => {
      // Regression: before the execId fix, onNodeRemoved fell back to the
      // interior node's local id (e.g. "1") when node.graph was already
      // null, so the error keyed under "2:1" was never removed.
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
        TestIds.dialogs.missingModelsGroup
      )
      await openErrorsTab(comfyPage)
      await expect(missingModelGroup).toBeVisible()

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      // Select-all + Delete: interior node IDs may be reassigned during
      // subgraph configure when they collide with root-graph IDs, so
      // looking up by static id can fail.
      await comfyPage.keyboard.selectAll()
      await comfyPage.page.keyboard.press('Delete')

      await expect(missingModelGroup).toBeHidden()
    })

    test('Deleting a node inside a subgraph removes its missing node-type error', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_nodes_in_subgraph')

      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(errorOverlay).toBeVisible()
      await errorOverlay
        .getByTestId(TestIds.dialogs.errorOverlayDismiss)
        .click()

      const missingNodeGroup = comfyPage.page.getByTestId(
        TestIds.dialogs.missingNodePacksGroup
      )
      await openErrorsTab(comfyPage)
      await expect(missingNodeGroup).toBeVisible()

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      // Select-all + Delete: interior node IDs may be reassigned during
      // subgraph configure when they collide with root-graph IDs, so
      // looking up by static id can fail.
      await comfyPage.keyboard.selectAll()
      await comfyPage.page.keyboard.press('Delete')

      await expect(missingNodeGroup).toBeHidden()
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
        TestIds.dialogs.missingModelsGroup
      )

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      await comfyPage.keyboard.selectAll()
      await comfyPage.keyboard.bypass()

      const errorsTab = comfyPage.page.getByTestId(
        TestIds.propertiesPanel.errorsTab
      )
      await comfyPage.actionbar.propertiesButton.click()
      await expect(errorsTab).toBeHidden()

      await comfyPage.keyboard.selectAll()
      await comfyPage.keyboard.bypass()
      await openErrorsTab(comfyPage)
      await expect(missingModelGroup).toBeVisible()
    })

    test('Loading a workflow with bypassed subgraph suppresses interior missing model error', async ({
      comfyPage
    }) => {
      // Regression: the initial scan pipeline only checked each node's
      // own mode, so interior nodes of a bypassed subgraph container
      // surfaced errors even though the container was excluded from
      // execution. The pipeline now post-filters candidates whose
      // ancestor path is not fully active.
      await comfyPage.workflow.loadWorkflow(
        'missing/missing_models_in_bypassed_subgraph'
      )

      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(errorOverlay).toBeHidden()

      await comfyPage.actionbar.propertiesButton.click()
      await expect(
        comfyPage.page.getByTestId(TestIds.propertiesPanel.errorsTab)
      ).toBeHidden()
    })

    test('Entering a bypassed subgraph does not resurface interior missing model error', async ({
      comfyPage
    }) => {
      // Regression: useGraphNodeManager replays graph.onNodeAdded for
      // each interior node on subgraph entry; without an ancestor-aware
      // guard in scanSingleNodeErrors, that re-scan reintroduced the
      // error that the initial pipeline had correctly suppressed.
      await comfyPage.workflow.loadWorkflow(
        'missing/missing_models_in_bypassed_subgraph'
      )

      const errorsTab = comfyPage.page.getByTestId(
        TestIds.propertiesPanel.errorsTab
      )
      await comfyPage.actionbar.propertiesButton.click()
      await expect(errorsTab).toBeHidden()

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      await expect(errorsTab).toBeHidden()
    })
  })

  test.describe('Workflow switching', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Sidebar'
      )
      await comfyPage.menu.workflowsTab.open()
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
        TestIds.dialogs.missingNodePacksGroup
      )

      await openErrorsTab(comfyPage)
      await expect(missingNodeGroup).toBeVisible()

      await comfyPage.menu.workflowsTab.open()
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await expect(missingNodeGroup).toBeHidden()

      await comfyPage.menu.workflowsTab.switchToWorkflow('missing_nodes')
      await openErrorsTab(comfyPage)
      await expect(missingNodeGroup).toBeVisible()
    })
  })
})
