import type { WebSocketRoute } from '@playwright/test'

type SubscriptionFrameType = 'doc_subscribe' | 'doc_unsubscribe'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseFrame(message: string): unknown {
  try {
    return JSON.parse(message)
  } catch {
    return null
  }
}

function isMatchingSubscriptionFrame(
  message: string,
  type: SubscriptionFrameType,
  workflowId: string
): boolean {
  const frame = parseFrame(message)
  if (!isRecord(frame) || frame.type !== type || !isRecord(frame.data))
    return false
  return frame.data.workflow_id === workflowId
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
