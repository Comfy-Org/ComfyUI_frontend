import type { WebSocketRoute } from '@playwright/test'

import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

import type { PromotedWidgetWriteData } from '@e2e/fixtures/data/agent/promotedWidgetWrite'
import {
  createPromotedWidgetWriteData,
  parsePromotedWidgetSubscribeWorkflowId
} from '@e2e/fixtures/data/agent/promotedWidgetWrite'

const SUBSCRIBE_TIMEOUT = 10_000

class PromotedWidgetWriteHost {
  async waitForSubscribe(ws: WebSocketRoute): Promise<string> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const subscribed = new Promise<string>((resolve) => {
      ws.onMessage((message) => {
        if (typeof message !== 'string') return
        const workflowId = parsePromotedWidgetSubscribeWorkflowId(message)
        if (workflowId) resolve(workflowId)
      })
    })
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('the Agent never sent doc_subscribe')),
        SUBSCRIBE_TIMEOUT
      )
    })
    try {
      return await Promise.race([subscribed, timeout])
    } finally {
      clearTimeout(timer)
    }
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
