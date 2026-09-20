import type { Page, WebSocketRoute } from '@playwright/test'
import type { ApplyOutcome, Op } from '@comfyorg/comfy-multi-player'

import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import { parseWireOps } from '@/workbench/extensions/agent/crdt/opEnvelope'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import type { HostDoc, HostFrame } from '@e2e/fixtures/agentConversationHostDoc'

const SUBSCRIBE_TIMEOUT = 15_000

/**
 * How the fake host treats a `doc_ops` batch the page mints for a human edit:
 * `apply` runs it through the real applier and answers like the relay does;
 * `hold` records it and never answers, so the batch stays in flight.
 */
export type HumanOpsHost = 'apply' | 'hold'

/** One `doc_*` frame the page sent, as the test attaches it. */
export interface ClientDocFrame {
  /** Milliseconds since the socket was created. */
  atMs: number
  type: string
  workflowId: string | null
  /** `op:node_id` per op for a `doc_ops` frame; empty otherwise. */
  ops: string[]
  opIds: string[]
}

interface ParsedClientDocFrame {
  type: string
  workflowId: string | null
  stateVector: string | null
  ops: Op[]
}

function docFrameEnvelope(
  raw: string | Buffer
): { type: string; data: Record<string, unknown> } | null {
  const frame: unknown = JSON.parse(raw.toString())
  if (typeof frame !== 'object' || frame === null) return null
  const { type, data } = frame as { type?: unknown; data?: unknown }
  if (typeof type !== 'string' || !type.startsWith('doc_')) return null
  if (typeof data !== 'object' || data === null) return null
  return { type, data: data as Record<string, unknown> }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function parseClientDocFrame(
  raw: string | Buffer
): ParsedClientDocFrame | null {
  const envelope = docFrameEnvelope(raw)
  if (!envelope) return null
  const { workflow_id, state_vector_b64, ops } = envelope.data
  return {
    type: envelope.type,
    workflowId: stringOrNull(workflow_id),
    stateVector: stringOrNull(state_vector_b64),
    ops: parseWireOps(ops)
  }
}

/** Routed `/ws` host shared by black-box Agent follower fixtures. */
export class AgentFollowerHostSocket {
  private socket: WebSocketRoute | null = null
  private subscribes = 0
  private readonly createdAt = Date.now()
  private readonly clientFrames: ClientDocFrame[] = []
  private readonly humanOutcomes: ApplyOutcome[] = []
  private resolveSubscribed: (() => void) | null = null
  private readonly subscribed = new Promise<void>((resolve) => {
    this.resolveSubscribed = resolve
  })

  constructor(
    private readonly page: Page,
    private readonly workflowId: string,
    private readonly host: HostDoc,
    private readonly socketSid: string,
    private readonly humanOpsHost: HumanOpsHost = 'hold'
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
    const frame = parseClientDocFrame(raw)
    if (!frame) return
    this.clientFrames.push({
      atMs: Date.now() - this.createdAt,
      type: frame.type,
      workflowId: frame.workflowId,
      ops: frame.ops.map(
        (op) => `${op.op}:${'node_id' in op ? String(op.node_id) : ''}`
      ),
      opIds: frame.ops.map((op) => op.op_id)
    })
    if (frame.workflowId !== this.workflowId) return
    if (frame.type === 'doc_subscribe' && frame.stateVector !== null)
      this.answerSubscribe(frame.stateVector)
    else if (frame.type === 'doc_ops' && this.humanOpsHost === 'apply')
      this.judgeHumanOps(frame.ops)
  }

  private answerSubscribe(stateVector: string): void {
    this.send(this.host.subscribed())
    this.send(this.host.catchUp(stateVector))
    this.subscribes += 1
    this.resolveSubscribed?.()
  }

  // The applier is the only judge of a human batch; the wire ops reach it
  // structurally, exactly as the relay hands them to the host.
  private judgeHumanOps(ops: Op[]): void {
    const { result, update, outcomes } = this.host.applyWire(ops)
    this.humanOutcomes.push(...outcomes)
    this.send(result)
    if (update) this.send(update)
  }

  /** Rises once per follower subscribe, after the catch-up frame was sent. */
  subscribeCount(): number {
    return this.subscribes
  }

  /** Every `doc_*` frame the page has sent so far, oldest first. */
  clientDocFrames(): ClientDocFrame[] {
    return [...this.clientFrames]
  }

  /** The applier's verdict on every human op the host has judged so far. */
  humanOpOutcomes(): ApplyOutcome[] {
    return [...this.humanOutcomes]
  }
}
