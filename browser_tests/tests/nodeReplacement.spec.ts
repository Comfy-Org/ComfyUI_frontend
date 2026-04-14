import type { Page } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  mockNodeReplacements,
  mockNodeReplacementsSingle
} from '@e2e/fixtures/data/nodeReplacements'
import type { NodeReplacementResponse } from '@/platform/nodeReplacement/types'
import { TestIds } from '@e2e/fixtures/selectors'
import { loadWorkflowAndOpenErrorsTab } from '@e2e/tests/propertiesPanel/ErrorsTabHelper'

/**
 * Mock the `/api/node_replacements` endpoint and enable the feature flag +
 * settings required for node replacement to function.
 */
async function setupNodeReplacement(
  comfyPage: ComfyPage,
  replacements: NodeReplacementResponse
) {
  await comfyPage.page.route('**/api/node_replacements', (route) =>
    route.fulfill({ json: replacements })
  )

  await comfyPage.settings.setSetting(
    'Comfy.RightSidePanel.ShowErrorsTab',
    true
  )
  await comfyPage.settings.setSetting('Comfy.NodeReplacement.Enabled', true)

  // Enable the server feature flag so the store fetches replacements.
  await comfyPage.page.evaluate(() => {
    const flags = window.app!.api.serverFeatureFlags
    flags.value = { ...flags.value, node_replacements: true }
  })
}

function getSwapNodesGroup(page: Page) {
  return page.getByTestId(TestIds.dialogs.swapNodesGroup)
}

test.describe('Node replacement', { tag: ['@node', '@ui'] }, () => {
  test.describe('Single replacement', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await setupNodeReplacement(comfyPage, mockNodeReplacementsSingle)
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/node_replacement_simple'
      )
    })

    test('Swap Nodes group appears in errors tab for replaceable nodes', async ({
      comfyPage
    }) => {
      const swapGroup = getSwapNodesGroup(comfyPage.page)
      await expect(swapGroup).toBeVisible()
      await expect(swapGroup).toContainText('E2E_OldSampler')
      await expect(
        swapGroup.getByRole('button', { name: 'Replace All', exact: true })
      ).toBeVisible()
    })

    test('Replace Node replaces a single group in-place', async ({
      comfyPage
    }) => {
      const swapGroup = getSwapNodesGroup(comfyPage.page)
      await swapGroup.getByRole('button', { name: /replace node/i }).click()

      // Swap group should disappear after replacement
      await expect(swapGroup).toBeHidden()

      // Verify the replacement was applied correctly via the exported workflow
      const workflow = await comfyPage.workflow.getExportedWorkflow()

      // Node count stays the same (in-place replacement)
      expect(
        workflow.nodes,
        'Node count should be unchanged after in-place replacement'
      ).toHaveLength(2)

      // The old type should be gone and replaced by KSampler
      const nodeTypes = workflow.nodes.map((n) => n.type)
      expect(nodeTypes).not.toContain('E2E_OldSampler')
      expect(nodeTypes).toContain('KSampler')

      // The replaced node should keep the same id
      const ksampler = workflow.nodes.find((n) => n.type === 'KSampler')
      expect(ksampler?.id).toBe(1)

      // Output connection from old node → VAEDecode should be preserved
      // Link tuple format: [link_id, source_node, source_slot, target_node, target_slot, type]
      const link = workflow.links?.find((l) => l[1] === 1 && l[3] === 2)
      expect(
        link,
        'Output link from replaced node to VAEDecode should be preserved'
      ).toBeDefined()
    })

    test('Widget values are preserved after replacement', async ({
      comfyPage
    }) => {
      await getSwapNodesGroup(comfyPage.page)
        .getByRole('button', { name: /replace node/i })
        .click()

      const workflow = await comfyPage.workflow.getExportedWorkflow()
      const ksampler = workflow.nodes.find((n) => n.type === 'KSampler')

      // The original workflow had widgets_values: [42, 20, 7, "euler", "normal"]
      // mapped to: seed=42, steps=20, cfg=7, sampler_name="euler", scheduler="normal"
      expect(ksampler?.widgets_values).toBeDefined()
      const widgetValues = ksampler!.widgets_values as unknown[]
      expect(widgetValues).toContain(42)
      expect(widgetValues).toContain(20)
    })

    test('Success toast is shown after replacement', async ({ comfyPage }) => {
      await getSwapNodesGroup(comfyPage.page)
        .getByRole('button', { name: /replace node/i })
        .click()

      await expect(comfyPage.visibleToasts.first()).toContainText(
        /replaced|swapped/i
      )
    })
  })

  test.describe('Multi-type replacement', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await setupNodeReplacement(comfyPage, mockNodeReplacements)
      await loadWorkflowAndOpenErrorsTab(
        comfyPage,
        'missing/node_replacement_multi'
      )
    })

    test('Replace All replaces all groups across multiple types', async ({
      comfyPage
    }) => {
      const swapGroup = getSwapNodesGroup(comfyPage.page)
      await expect(swapGroup).toBeVisible()

      // Both types should appear
      await expect(swapGroup).toContainText('E2E_OldSampler')
      await expect(swapGroup).toContainText('E2E_OldUpscaler')

      // Click "Replace All"
      await swapGroup
        .getByRole('button', { name: 'Replace All', exact: true })
        .click()

      // Swap group should disappear
      await expect(swapGroup).toBeHidden()

      // Verify both old types are gone
      const workflow = await comfyPage.workflow.getExportedWorkflow()
      const nodeTypes = workflow.nodes.map((n) => n.type)
      expect(nodeTypes).not.toContain('E2E_OldSampler')
      expect(nodeTypes).not.toContain('E2E_OldUpscaler')
      expect(nodeTypes).toContain('KSampler')
      expect(nodeTypes).toContain('ImageScaleBy')
    })

    test('Output connections are preserved across replacement with output mapping', async ({
      comfyPage
    }) => {
      await getSwapNodesGroup(comfyPage.page)
        .getByRole('button', { name: 'Replace All', exact: true })
        .click()

      const workflow = await comfyPage.workflow.getExportedWorkflow()

      // E2E_OldUpscaler (id=2) had an output link to SaveImage (id=3).
      // After replacement to ImageScaleBy, that link should be preserved.
      // Link tuple format: [link_id, source_node, source_slot, target_node, target_slot, type]
      const linkToSave = workflow.links?.find((l) => l[1] === 2 && l[3] === 3)
      expect(
        linkToSave,
        'Output link from replaced upscaler to SaveImage should be preserved'
      ).toBeDefined()
    })
  })
})
