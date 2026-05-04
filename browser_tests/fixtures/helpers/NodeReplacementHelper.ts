import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { NodeReplacementResponse } from '@/platform/nodeReplacement/types'

/**
 * Mock `/api/node_replacements` and enable the node replacement feature.
 *
 * Unlike features that only consult settings (e.g. shareWorkflowDialog,
 * managerDialog), node replacement gates on `api.serverFeatureFlags`. The
 * server sends a `feature_flags` WS message that wholesale replaces
 * `serverFeatureFlags`, racing with any test-side override done via
 * `page.evaluate`. To make the flow deterministic across CI shards, this
 * helper patches `WebSocket.prototype` so every incoming `feature_flags`
 * message has `node_replacements: true` injected before the api's WS
 * handler sees it. Reload the page so the patched WebSocket and persisted
 * settings apply to a fresh app boot, then wait for the resulting
 * `/api/node_replacements` fetch before returning.
 */
export async function setupNodeReplacement(
  comfyPage: ComfyPage,
  replacements: NodeReplacementResponse
): Promise<void> {
  await comfyPage.page.route('**/api/node_replacements', (route) =>
    route.fulfill({ json: replacements })
  )

  await comfyPage.settings.setSetting(
    'Comfy.RightSidePanel.ShowErrorsTab',
    true
  )
  await comfyPage.settings.setSetting('Comfy.NodeReplacement.Enabled', true)

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

  const fetchPromise = comfyPage.page.waitForResponse(
    (response) =>
      response.url().includes('/api/node_replacements') && response.ok(),
    { timeout: 10000 }
  )

  await comfyPage.workflow.reloadAndWaitForApp()
  await fetchPromise
}

export function getSwapNodesGroup(page: Page): Locator {
  return page.getByTestId(TestIds.dialogs.swapNodesGroup)
}
