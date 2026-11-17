import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { NodeReplacementResponse } from '@/platform/workflowErrors/nodeReplacement/types'

export async function setupNodeReplacement(
  comfyPage: ComfyPage,
  replacements: NodeReplacementResponse
): Promise<void> {
  await comfyPage.page.route('**/api/node_replacements', (route) =>
    route.fulfill({ json: replacements })
  )

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
                return listener.call(this, patched)
              }
            } catch {
              return listener.call(this, event)
            }
          }
          return listener.call(this, event)
        }
        return originalAdd.call(this, type, wrapped, options)
      }
      return originalAdd.call(
        this,
        type,
        listener as EventListenerOrEventListenerObject,
        options
      )
    }
  })

  await comfyPage.workflow.reloadAndWaitForApp()
  await expect
    .poll(() =>
      comfyPage.page.evaluate(() =>
        window.app!.api.getServerFeature('node_replacements', false)
      )
    )
    .toBe(true)
}

export function getSwapNodesGroup(page: Page): Locator {
  return page.getByTestId(TestIds.dialogs.swapNodesGroup)
}
