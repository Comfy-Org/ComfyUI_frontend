import type { WebSocketRoute } from '@playwright/test'

type SubscriptionFrameType = 'doc_subscribe' | 'doc_unsubscribe'

function isMatchingSubscriptionFrame(
  message: string,
  type: SubscriptionFrameType,
  workflowId: string
): boolean {
  try {
    const frame: unknown = JSON.parse(message)
    if (typeof frame !== 'object' || frame === null) return false
    if (!('type' in frame) || frame.type !== type) return false
    if (!('data' in frame) || typeof frame.data !== 'object' || !frame.data)
      return false
    return 'workflow_id' in frame.data && frame.data.workflow_id === workflowId
  } catch {
    return false
  }
}

export function countDocFrames(
  messagesBySocket: Map<WebSocketRoute, string[]>,
  ws: WebSocketRoute,
  type: SubscriptionFrameType,
  workflowId: string
): number {
  return (messagesBySocket.get(ws) ?? []).filter((message) =>
    isMatchingSubscriptionFrame(message, type, workflowId)
  ).length
}
