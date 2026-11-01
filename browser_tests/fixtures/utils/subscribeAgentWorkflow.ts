import { expect } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'

import type { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

interface SubscribeAgentWorkflowInput {
  agentPanel: AgentPanel
  socket: WebSocketRoute
  workflowId: string
  prompt: string
}

export async function subscribeAgentWorkflow({
  agentPanel,
  socket,
  workflowId,
  prompt
}: SubscribeAgentWorkflowInput): Promise<string[]> {
  const outboundFrames: string[] = []
  socket.onMessage((message) => outboundFrames.push(String(message)))
  await agentPanel.selectWorkflow()
  await agentPanel.sendMessage(prompt)
  await expect
    .poll(() => outboundFrames, { timeout: 15_000 })
    .toContainEqual(
      expect.stringMatching(
        new RegExp(`doc_subscribe.*${workflowId}|${workflowId}.*doc_subscribe`)
      )
    )
  return outboundFrames
}
