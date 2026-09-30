import type { Page } from '@playwright/test'

/**
 * Marks that the injected throw actually fired, so a spec asserts on the
 * fault it set up rather than passing when the frame stops matching.
 */
export const INJECTED_DOC_OPS_THROWS_ATTR = 'data-injected-doc-ops-throws'

/**
 * Makes the first outbound `doc_ops` frame throw out of `WebSocket.send`,
 * the shape a transport takes when it refuses a frame it cannot serialize.
 * Later frames go out untouched, so the op sender's retry is what recovers.
 */
export async function throwOnFirstDocOpsSend(page: Page): Promise<void> {
  await page.addInitScript((markAttr: string) => {
    function isDocOpsFrame(data: Parameters<WebSocket['send']>[0]): boolean {
      if (typeof data !== 'string') return false
      try {
        const frame: unknown = JSON.parse(data)
        return (
          typeof frame === 'object' &&
          frame !== null &&
          'type' in frame &&
          frame.type === 'doc_ops'
        )
      } catch {
        return false
      }
    }

    const nativeSend = WebSocket.prototype.send
    let throwsLeft = 1
    WebSocket.prototype.send = function (
      data: Parameters<WebSocket['send']>[0]
    ) {
      if (isDocOpsFrame(data) && throwsLeft > 0) {
        throwsLeft--
        document.documentElement.setAttribute(markAttr, '1')
        throw new Error('injected doc_ops transport failure')
      }
      nativeSend.call(this, data)
    }
  }, INJECTED_DOC_OPS_THROWS_ATTR)
}
