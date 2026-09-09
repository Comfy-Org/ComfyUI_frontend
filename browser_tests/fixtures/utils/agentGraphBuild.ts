import { mint } from '@comfyorg/comfy-multi-player'
import type { WebSocketRoute } from '@playwright/test'
import * as Y from 'yjs'

import workflow from '@e2e/assets/agent/reference-preparation.json' with { type: 'json' }
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  AGENT_TEST_THREAD_ID,
  AGENT_TEST_WORKFLOW_ID
} from '@e2e/tests/agent/agentPanelMocks'

export function waitForClientFrame(
  ws: WebSocketRoute,
  type: string
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.onMessage((message) => {
      if (typeof message !== 'string') return
      let frame: unknown
      try {
        frame = JSON.parse(message)
      } catch {
        return
      }
      if (
        typeof frame !== 'object' ||
        frame === null ||
        !('type' in frame) ||
        frame.type !== type ||
        !('data' in frame)
      )
        return
      const data = frame.data
      if (typeof data !== 'object' || data === null || Array.isArray(data))
        return
      resolve({ ...data })
    })
  })
}

export async function deliverGraphBuild(
  ws: WebSocketRoute,
  subscribed: ReturnType<typeof waitForClientFrame>
): Promise<void> {
  ws.send(
    JSON.stringify({
      type: 'agent_active_tab',
      data: {
        workflow_id: AGENT_TEST_WORKFLOW_ID,
        name: 'Reference preparation',
        thread_id: AGENT_TEST_THREAD_ID
      }
    })
  )
  await expect(subscribed).resolves.toMatchObject({
    workflow_id: AGENT_TEST_WORKFLOW_ID
  })
  ws.send(
    JSON.stringify({
      type: 'doc_subscribed',
      data: { v: 1, workflow_id: AGENT_TEST_WORKFLOW_ID, ok: true, seq: 0 }
    })
  )
  const host = mint(workflow, {
    types: {
      LoadImage: { widget_order: ['image'] },
      ImageScale: {
        widget_order: ['upscale_method', 'width', 'height', 'crop']
      },
      PreviewImage: { widget_order: [] }
    }
  })
  const update = Y.encodeStateAsUpdate(host)
  host.destroy()
  ws.send(
    JSON.stringify({
      type: 'doc_update',
      data: {
        v: 1,
        workflow_id: AGENT_TEST_WORKFLOW_ID,
        seq: 1,
        update_b64: Buffer.from(update).toString('base64'),
        actor: 'agent:e2e',
        op_ids: ['build-reference-workflow']
      }
    })
  )
}
