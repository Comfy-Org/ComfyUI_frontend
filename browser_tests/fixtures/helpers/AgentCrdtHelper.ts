import type { WebSocketRoute } from '@playwright/test'
import * as Y from 'yjs'

import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'

type ClientDocFrame = {
  type?: unknown
  data?: { workflow_id?: unknown }
}

function encodeBase64(update: Uint8Array): string {
  return Buffer.from(update).toString('base64')
}

function parseClientFrame(message: string | Buffer): ClientDocFrame | null {
  try {
    const value: unknown = JSON.parse(message.toString())
    return typeof value === 'object' && value !== null ? value : null
  } catch {
    return null
  }
}

/**
 * Black-box driver for the agent document protocol. It observes the product's
 * real `doc_subscribe` request and delivers host frames through the routed
 * ComfyUI WebSocket; it never reaches into app, graph, or Pinia internals.
 */
export class AgentCrdtHelper {
  private readonly host: Y.Doc
  private sequence = 0

  constructor(
    private readonly ws: WebSocketRoute,
    private readonly clientMessages: () => readonly (string | Buffer)[],
    workflow: WorkflowJSON,
    private readonly catalog: WidgetCatalog
  ) {
    this.host = mint(workflow, catalog)
  }

  private send(type: string, data: Record<string, unknown>): void {
    this.ws.send(JSON.stringify({ type, data }))
  }

  async waitForSubscription(timeoutMs = 10_000): Promise<string> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      for (const message of this.clientMessages()) {
        const frame = parseClientFrame(message)
        if (
          frame?.type === 'doc_subscribe' &&
          typeof frame.data?.workflow_id === 'string'
        ) {
          return frame.data.workflow_id
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error('Timed out waiting for the agent doc_subscribe frame')
  }

  async seedSubscribedDocument(): Promise<string> {
    const workflowId = await this.waitForSubscription()
    this.send('doc_subscribed', {
      v: 1,
      workflow_id: workflowId,
      ok: true,
      seq: this.sequence
    })
    this.send('doc_update', {
      v: 1,
      workflow_id: workflowId,
      seq: this.sequence,
      update_b64: encodeBase64(Y.encodeStateAsUpdate(this.host)),
      actor: 'agent:e2e:harness'
    })
    this.sequence += 1
    return workflowId
  }

  applyAgentOps(workflowId: string, ops: Op[]): void {
    const stateVector = Y.encodeStateVector(this.host)
    const result = applyOps(this.host, ops, this.catalog)
    const rejected = result.outcomes.find(
      ({ outcome }) => outcome === 'rejected'
    )
    if (rejected)
      throw new Error(
        `Agent CRDT fixture op was rejected: ${JSON.stringify(rejected)}`
      )

    this.send('doc_update', {
      v: 1,
      workflow_id: workflowId,
      seq: this.sequence,
      update_b64: encodeBase64(Y.encodeStateAsUpdate(this.host, stateVector)),
      actor: 'agent:e2e:harness',
      op_ids: ops.map(({ op_id }) => op_id)
    })
    this.sequence += 1
  }
}
