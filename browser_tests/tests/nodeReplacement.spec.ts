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
import { loadWorkflowAndOpenErrorsTab } from '@e2e/fixtures/helpers/ErrorsTabHelper'

/**
 * Mock the `/api/node_replacements` endpoint and enable the feature flag +
 * settings required for node replacement to function.
 *
 * The store's `load()` only fetches when `api.serverFeatureFlags` includes
 * `node_replacements: true`. The server sends a `feature_flags` WS message
 * that wholesale replaces `serverFeatureFlags`, which races with any
 * test-side override done via `page.evaluate`. To make the flow
 * deterministic across CI shards, this helper:
 *
 * 1. Routes `/api/node_replacements` to the mock data.
 * 2. Persists the `Comfy.NodeReplacement.Enabled` and `ShowErrorsTab`
 *    settings server-side via `setSetting`.
 * 3. Installs an `addInitScript` that patches `WebSocket.prototype` so
 *    every incoming `feature_flags` message has `node_replacements: true`
 *    injected before the api's WS handler sees it.
 * 4. Reloads the page so the patched WebSocket and the persisted settings
 *    apply to a fresh app boot.
 * 5. Waits for the resulting `/api/node_replacements` fetch to complete,
 *    so the store is fully loaded before the test triggers a workflow
 *    load.
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

  // Patch WebSocket so every incoming `feature_flags` message has
  // `node_replacements: true` injected. Survives WS reconnects and
  // any number of server-sent feature_flags messages.
  await comfyPage.page.addInitScript(() => {
    const proto = window.WebSocket.prototype
    const originalAdd = proto.addEventListener
    proto.addEventListener = function patchedAdd(
      this: WebSocket,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: AddEventListenerOptions | boolean
    ) {
      if (type === 'message' && typeof listener === 'function') {
        const wrapped = function (this: WebSocket, event: Event) {
          const msgEvent = event as MessageEvent
          if (typeof msgEvent.data === 'string') {
            try {
              const msg = JSON.parse(msgEvent.data)
              if (
                msg &&
                msg.type === 'feature_flags' &&
                msg.data &&
                typeof msg.data === 'object'
              ) {
                msg.data.node_replacements = true
                const patched = new MessageEvent('message', {
                  data: JSON.stringify(msg),
                  origin: msgEvent.origin,
                  lastEventId: msgEvent.lastEventId
                })
                return (listener as EventListener).call(this, patched)
              }
            } catch {
              // not JSON or not a feature_flags message - pass through
            }
          }
          return (listener as EventListener).call(this, event)
        }
        return originalAdd.call(this, type, wrapped as EventListener, options)
      }
      return originalAdd.call(
        this,
        type,
        listener as EventListenerOrEventListenerObject,
        options
      )
    }
  })

  // Set up the response listener BEFORE reload so we don't miss a
  // fast-arriving fetch.
  const fetchPromise = comfyPage.page.waitForResponse(
    (response) =>
      response.url().includes('/api/node_replacements') && response.ok(),
    { timeout: 10000 }
  )

  await comfyPage.workflow.reloadAndWaitForApp()
  await fetchPromise
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

      expect(ksampler?.widgets_values).toBeDefined()
      const widgetValues = ksampler!.widgets_values as unknown[]
      expect(widgetValues).toEqual(
        expect.arrayContaining([42, 20, 7, 'euler', 'normal'])
      )
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
