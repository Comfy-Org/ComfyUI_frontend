import type { Page, WebSocketRoute } from '@playwright/test'
import { z } from 'zod'

import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import type { HostDoc, HostFrame } from '@e2e/fixtures/agentConversationHostDoc'

const SUBSCRIBE_TIMEOUT = 15_000

/** A doc frame the follower put on the wire, as the host received it. */
export interface ClientDocFrame {
  type: 'doc_subscribe' | 'doc_unsubscribe' | 'doc_ops'
  workflowId: string
  ops: { op: string }[]
}

const zClientDocFrame = z.object({
  type: z.enum(['doc_subscribe', 'doc_unsubscribe', 'doc_ops']),
  data: z.object({
    workflow_id: z.string(),
    ops: z.array(z.object({ op: z.string() }).passthrough()).default([])
  })
})

/** Routed `/ws` host shared by black-box Agent follower fixtures. */
export class AgentFollowerHostSocket {
  private socket: WebSocketRoute | null = null
  private subscribes = 0
  private readonly clientDocFrames: ClientDocFrame[] = []
  private resolveSubscribed: (() => void) | null = null
  private readonly subscribed = new Promise<void>((resolve) => {
    this.resolveSubscribed = resolve
  })

  constructor(
    private readonly page: Page,
    private readonly workflowId: string,
    private readonly host: HostDoc,
    private readonly socketSid: string
  ) {}

  async install(): Promise<void> {
    await this.page.routeWebSocket(/\/ws/, (socket) => {
      this.socket = socket
      socket.onMessage((raw) => this.onClientFrame(raw))
      socket.send(
        JSON.stringify({
          type: 'status',
          data: {
            status: { exec_info: { queue_remaining: 0 } },
            sid: this.socketSid
          }
        })
      )
    })
  }

  send(frame: AgentWsEvent | HostFrame): void {
    if (frame.type.startsWith('doc_') || frame.type === 'awareness') {
      if (parseServerDocFrame(frame) === null)
        throw new Error(`host frame ${frame.type} is not a valid doc frame`)
    } else if (!parseAgentWsEvent(frame).success) {
      throw new Error(`agent event ${frame.type} is not a valid agent event`)
    }
    if (!this.socket) throw new Error('the app has not opened /ws yet')
    this.socket.send(JSON.stringify(frame))
  }

  async waitForSubscribe(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `the follower never subscribed to workflow ${this.workflowId}`
            )
          ),
        SUBSCRIBE_TIMEOUT
      )
    })
    try {
      await Promise.race([this.subscribed, timeout])
    } finally {
      clearTimeout(timer)
    }
  }

  private onClientFrame(raw: string | Buffer): void {
    const frame: unknown = JSON.parse(raw.toString())
    if (typeof frame !== 'object' || frame === null) return
    this.recordClientDocFrame(frame)
    const { type, data } = frame as { type?: unknown; data?: unknown }
    if (type !== 'doc_subscribe' || typeof data !== 'object' || data === null)
      return
    const { workflow_id, state_vector_b64 } = data as {
      workflow_id?: unknown
      state_vector_b64?: unknown
    }
    if (workflow_id !== this.workflowId || typeof state_vector_b64 !== 'string')
      return
    this.send(this.host.subscribed())
    this.send(this.host.catchUp(state_vector_b64))
    this.subscribes += 1
    this.resolveSubscribed?.()
  }

  private recordClientDocFrame(frame: unknown): void {
    const parsed = zClientDocFrame.safeParse(frame)
    if (!parsed.success) return
    const { type, data } = parsed.data
    this.clientDocFrames.push({
      type,
      workflowId: data.workflow_id,
      ops: data.ops
    })
  }

  /** Rises once per follower subscribe, after the catch-up frame was sent. */
  subscribeCount(): number {
    return this.subscribes
  }

  /** Every subscribe, unsubscribe and human-ops frame the follower has sent, in order. */
  docFrames(): readonly ClientDocFrame[] {
    return this.clientDocFrames
  }
}
