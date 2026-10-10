import type { WebSocketRoute } from '@playwright/test'

import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

import type { PromotedWidgetWriteData } from '@e2e/fixtures/data/agent/promotedWidgetWrite'
import {
  createPromotedWidgetWriteData,
  parsePromotedWidgetSubscribeWorkflowId
} from '@e2e/fixtures/data/agent/promotedWidgetWrite'

class PromotedWidgetWriteHost {
  captureSubscribeWorkflowId(ws: WebSocketRoute): () => string | undefined {
    let workflowId: string | undefined
    ws.onMessage((message) => {
      if (typeof message !== 'string') return
      workflowId ??= parsePromotedWidgetSubscribeWorkflowId(message)
    })
    return () => workflowId
  }
}

export const promotedWidgetWriteFixture = base.extend<{
  promotedWidgetWriteData: PromotedWidgetWriteData
  promotedWidgetWriteHost: PromotedWidgetWriteHost
}>({
  promotedWidgetWriteData: async ({ networkPolicy: _networkPolicy }, use) => {
    await use(createPromotedWidgetWriteData())
  },
  promotedWidgetWriteHost: async ({ networkPolicy: _networkPolicy }, use) => {
    await use(new PromotedWidgetWriteHost())
  }
})
