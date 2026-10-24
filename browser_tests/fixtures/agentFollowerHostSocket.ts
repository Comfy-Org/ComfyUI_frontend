import type { Page, WebSocketRoute } from '@playwright/test'
import type { ApplyOutcome } from '@comfyorg/comfy-multi-player'
import type { AgentAskServerFrame } from '@comfyorg/ingest-types'

import {
  DOC_PROTOCOL_VERSION,
  parseServerDocFrame
} from '@/workbench/extensions/agent/crdt/docFrameClient'
import type {
  ExecutedWsMessage,
  ExecutingWsMessage,
  ExecutionErrorWsMessage,
  ExecutionInterruptedWsMessage,
  ExecutionStartWsMessage,
  ExecutionSuccessWsMessage,
  ProgressStateWsMessage,
  ProgressWsMessage,
  StatusWsMessage
} from '@/platform/remote/comfyui/execution/types'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import type { HostDoc, HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { AGENT_SOCKET_URL } from '@e2e/fixtures/agentSocket'
import { isValidDocOpsBatch, parseWireOps } from '@e2e/fixtures/agentWireFrame'
import type {
  ParsedWireBatch,
  WireOpEnvelope
} from '@e2e/fixtures/agentWireFrame'

const SUBSCRIBE_TIMEOUT = 15_000
/** The sid the fake ComfyUI reports on its first `status` frame. */
export const COMFY_SOCKET_SID = '7d1f2e3a-4b5c-4d6e-8f90-1a2b3c4d5e6f'

/**
 * ComfyUI execution frames the fake host can emit alongside doc and agent
 * frames, typed against the app's own ws message shapes so a fixture cannot
 * drift from what `executionStore` actually parses.
 */
export type ExecutionHostFrame =
  | { type: 'status'; data: StatusWsMessage }
  | { type: 'execution_start'; data: ExecutionStartWsMessage }
  | { type: 'executing'; data: ExecutingWsMessage }
  | { type: 'executed'; data: ExecutedWsMessage }
  | { type: 'execution_success'; data: ExecutionSuccessWsMessage }
  | { type: 'execution_error'; data: ExecutionErrorWsMessage }
  | { type: 'execution_interrupted'; data: ExecutionInterruptedWsMessage }
  | { type: 'progress'; data: ProgressWsMessage }
  | { type: 'progress_state'; data: ProgressStateWsMessage }

/**
 * How the fake host treats a `doc_ops` batch the page mints for a human edit:
 * `apply` runs it through the real applier and answers like the relay does;
 * `hold` records it and never answers, so the batch stays in flight.
 */
export type HumanOpsHost = 'apply' | 'hold'
export type HostUpdateSink = (frame: HostFrame) => void

/** One `doc_*` frame the page sent, as the test attaches it. */
export interface ClientDocFrame {
  /** Milliseconds since the socket was created. */
  atMs: number
  type: string
  workflowId: string | null
  tab: string | null
  stateVector: string | null
  /** `op:node_id` per op for a `doc_ops` frame; empty otherwise. */
  ops: string[]
  opIds: string[]
  writers: Array<string | null>
  connection: number
  comfyConnection: number
}

interface ParsedClientDocFrame {
  type: string
  workflowId: string | null
  tab: string | null
  stateVector: string | null
  opsResult: ParsedWireBatch
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

function claimedWriter(op: WireOpEnvelope): string | null {
  const actor = 'actor' in op ? op.actor : undefined
  const stamp = 'stamp' in op ? op.stamp : undefined
  const stampActor = Array.isArray(stamp) ? stamp[1] : undefined
  return typeof actor === 'string' && actor === stampActor ? actor : null
}

function claimsOneFrameActor(ops: WireOpEnvelope[], tab: string): boolean {
  const writers = new Set(ops.map(claimedWriter))
  const [writer] = writers
  if (writers.size !== 1 || !writer) return false
  const [kind, user, claimedTab, ...rest] = writer.split(':')
  return kind === 'human' && !!user && claimedTab === tab && rest.length === 0
}

function opLabel(op: WireOpEnvelope): string {
  return `${op.op}:${'node_id' in op ? String(op.node_id) : ''}`
}

function parseClientDocFrame(
  raw: string | Buffer
): ParsedClientDocFrame | null {
  const envelope = docFrameEnvelope(raw)
  if (!envelope) return null
  const { workflow_id, tab, state_vector_b64, ops } = envelope.data
  return {
    type: envelope.type,
    workflowId: stringOrNull(workflow_id),
    tab: stringOrNull(tab),
    stateVector: stringOrNull(state_vector_b64),
    opsResult: parseWireOps(ops)
  }
}

export class AgentFollowerHostSocket {
  private refuseReason: string | null = null
  private refusalsLeft = 0
  private refusedSubscribes = 0

  private socket: WebSocketRoute | null = null
  private comfySocket: WebSocketRoute | null = null
  private comfyConnections = 0
  private connections = 0
  private unansweredHumanBatches = 0
  private subscribes = 0
  private subscribeAnswer = (stateVector: string): HostFrame[] => [
    this.host.subscribed(),
    this.host.catchUp(stateVector)
  ]
  private readonly createdAt = Date.now()
  private readonly clientFrames: ClientDocFrame[] = []
  private readonly heldBatches: Array<{
    tab: string | null
    ops: WireOpEnvelope[]
  }> = []
  private readonly humanOutcomes: ApplyOutcome[] = []
  private resolveSubscribed: (() => void) | null = null
  private readonly subscribed = new Promise<void>((resolve) => {
    this.resolveSubscribed = resolve
  })

  private fixedSid: string | undefined

  constructor(
    private readonly page: Page,
    private readonly workflowId: string,
    private readonly host: HostDoc,
    private readonly humanOpsHost: HumanOpsHost = 'hold',
    private readonly hostUpdateSink?: HostUpdateSink
  ) {}

  /** Pins the `status` sid; `''` models a socket with no id. */
  reportSocketSid(sid: string): this {
    this.fixedSid = sid
    return this
  }

  async install(): Promise<void> {
    await this.page.routeWebSocket(/\/ws/, (socket) => {
      this.comfySocket = socket
      this.comfyConnections += 1
      const sid =
        this.fixedSid ??
        (this.comfyConnections === 1
          ? COMFY_SOCKET_SID
          : `${COMFY_SOCKET_SID}-${this.comfyConnections}`)
      socket.send(
        JSON.stringify({
          type: 'status',
          data: {
            status: { exec_info: { queue_remaining: 0 } },
            sid
          }
        })
      )
    })
    await this.page.routeWebSocket(AGENT_SOCKET_URL, (socket) => {
      this.connections += 1
      this.socket = socket
      socket.onMessage((raw) => this.onClientFrame(raw))
    })
  }

  send(frame: AgentWsEvent | AgentAskServerFrame | HostFrame): void {
    if (frame.type.startsWith('doc_') || frame.type === 'awareness') {
      if (parseServerDocFrame(frame) === null)
        throw new Error(`host frame ${frame.type} is not a valid doc frame`)
    } else if (!parseAgentWsEvent(frame).success) {
      throw new Error(`agent event ${frame.type} is not a valid agent event`)
    }
    if (!this.socket)
      throw new Error('the panel has not opened the agent socket yet')
    this.socket.send(JSON.stringify(frame))
  }

  sendExecution(frame: ExecutionHostFrame): void {
    if (!this.comfySocket) throw new Error('the app has not opened /ws yet')
    this.comfySocket.send(JSON.stringify(frame))
  }

  comfyConnectionCount(): number {
    return this.comfyConnections
  }

  sendExecutionBinary(frame: Buffer): void {
    if (!this.comfySocket) throw new Error('the app has not opened /ws yet')
    this.comfySocket.send(frame)
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
    this.recordClientFrame(frame)
    if (frame.workflowId !== this.workflowId) {
      this.rejectForeignOps(frame)
      return
    }
    this.routeClientDocFrame(frame)
  }

  private recordClientFrame(frame: ParsedClientDocFrame): void {
    const ops = frame.opsResult.ok ? frame.opsResult.ops : []
    this.clientFrames.push({
      atMs: Date.now() - this.createdAt,
      type: frame.type,
      workflowId: frame.workflowId,
      tab: frame.tab,
      stateVector: frame.stateVector,
      ops: ops.map((op) => opLabel(op)),
      opIds: ops.map((op) => op.op_id),
      writers: ops.map(claimedWriter),
      connection: this.connections,
      comfyConnection: this.comfyConnections
    })
  }

  private routeClientDocFrame(frame: ParsedClientDocFrame): void {
    if (frame.type === 'doc_subscribe' && frame.stateVector !== null) {
      this.answerSubscribe(frame.stateVector)
      return
    }
    if (frame.type === 'doc_ops') this.receiveHumanOps(frame)
  }

  private receiveHumanOps(frame: ParsedClientDocFrame): void {
    if (this.unansweredHumanBatches > 0 && this.wouldAcceptHumanOps(frame)) {
      this.unansweredHumanBatches -= 1
      return
    }
    if (this.humanOpsHost === 'apply') {
      this.judgeHumanOps(frame.opsResult, frame.tab)
      return
    }
    if (frame.opsResult.ok) {
      this.heldBatches.push({ tab: frame.tab, ops: frame.opsResult.ops })
    }
  }

  /** Human ops a `hold` host is still sitting on, oldest first. */
  heldClientOps(): WireOpEnvelope[] {
    return this.heldBatches.flatMap((batch) => batch.ops)
  }

  /** Judges the oldest held batch exactly as an `apply` host judges a new one. */
  releaseHeldClientOps(): WireOpEnvelope[] {
    const batch = this.heldBatches.shift()
    if (!batch) return []
    this.judgeHumanOps({ ok: true, ops: batch.ops }, batch.tab)
    return batch.ops
  }

  refuseSubscribes(
    reason = 'overloaded',
    times = Number.POSITIVE_INFINITY
  ): void {
    this.refuseReason = reason
    this.refusalsLeft = times
  }

  answerSubscribesWith(answer: (stateVector: string) => HostFrame[]): void {
    this.subscribeAnswer = answer
  }

  private answerSubscribe(stateVector: string): void {
    if (this.refuseReason !== null && this.refusalsLeft > 0) {
      this.refusalsLeft -= 1
      this.refusedSubscribes += 1
      const refusal = this.host.subscribeRefused(this.refuseReason)
      this.send({
        ...refusal,
        data: { ...refusal.data, code: this.refuseReason }
      })
      this.resolveSubscribed?.()
      return
    }
    for (const frame of this.subscribeAnswer(stateVector)) this.send(frame)
    this.subscribes += 1
    this.resolveSubscribed?.()
  }

  /** Subscribes this host turned away, so a retry ladder can be asserted. */
  refusedSubscribeCount(): number {
    return this.refusedSubscribes
  }

  /** Records the next `count` well-formed human batches as lost in transit. */
  leaveHumanBatchesUnanswered(count = 1): void {
    this.unansweredHumanBatches += count
  }

  private wouldAcceptHumanOps({ opsResult, tab }: ParsedClientDocFrame) {
    return 'ops' in this.classifyHumanOps(opsResult, tab)
  }

  private classifyHumanOps(
    opsResult: ParsedWireBatch,
    tab: string | null
  ): { ops: WireOpEnvelope[] } | { refusal: HostFrame } {
    if (!opsResult.ok || !tab || !isValidDocOpsBatch(opsResult.ops))
      return { refusal: this.invalidFrameResult() }
    if (!claimsOneFrameActor(opsResult.ops, tab))
      return { refusal: this.forbiddenResult() }
    return { ops: opsResult.ops }
  }

  private judgeHumanOps(opsResult: ParsedWireBatch, tab: string | null): void {
    const verdict = this.classifyHumanOps(opsResult, tab)
    if ('refusal' in verdict) {
      this.send(verdict.refusal)
      return
    }
    const { result, update, outcomes } = this.host.applyWire(verdict.ops)
    this.humanOutcomes.push(...outcomes)
    this.send(result)
    if (update) (this.hostUpdateSink ?? ((frame) => this.send(frame)))(update)
  }

  // A doc_ops batch for a workflow this host does not serve gets a failed
  // doc_ops_result for that workflow, so the sender settles it instead of
  // waiting forever; any other foreign frame is ignored.
  private rejectForeignOps(frame: ParsedClientDocFrame): void {
    if (frame.type !== 'doc_ops' || frame.workflowId === null) return
    this.send({
      type: 'doc_ops_result',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: frame.workflowId,
        ok: false,
        applied: [],
        skipped: [],
        code: 'unknown_workflow',
        message: 'the fake host serves one workflow'
      }
    })
  }

  private invalidFrameResult(): HostFrame {
    return {
      type: 'doc_ops_result',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: this.workflowId,
        ok: false,
        code: 'invalid_frame',
        message: 'doc_ops frame was not structurally valid'
      }
    }
  }

  private forbiddenResult(): HostFrame {
    return {
      type: 'doc_ops_result',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: this.workflowId,
        ok: false,
        code: 'forbidden',
        message: 'op actor does not match the authenticated writer'
      }
    }
  }

  /**
   * Rises once per subscribe the host accepted, after its answer was sent.
   * A custom answer from {@link answerSubscribesWith} may carry no catch-up;
   * refused subscribes count only in {@link refusedSubscribeCount}.
   */
  subscribeCount(): number {
    return this.subscribes
  }

  connectionCount(): number {
    return this.connections
  }

  async disconnect(): Promise<void> {
    if (!this.socket)
      throw new Error('the panel has not opened the agent socket yet')
    await this.socket.close()
  }

  /** Closes `/ws`; the app reconnects with a fresh session id. */
  async disconnectComfySocket(): Promise<void> {
    const socket = this.comfySocket
    if (!socket) throw new Error('the app has not opened /ws yet')
    this.comfySocket = null
    await socket.close()
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
