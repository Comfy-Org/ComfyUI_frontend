import type { Page, WebSocketRoute } from '@playwright/test'
import type { ApplyOutcome } from '@comfyorg/comfy-multi-player'

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
import { isValidDocOpsBatch, parseWireOps } from '@e2e/fixtures/agentWireFrame'
import type {
  ParsedWireBatch,
  WireOpEnvelope
} from '@e2e/fixtures/agentWireFrame'

const SUBSCRIBE_TIMEOUT = 15_000

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

/** One `doc_*` frame the page sent, as the test attaches it. */
export interface ClientDocFrame {
  /** Milliseconds since the socket was created. */
  atMs: number
  type: string
  workflowId: string | null
  /** `op:node_id` per op for a `doc_ops` frame; empty otherwise. */
  ops: string[]
  opIds: string[]
  baseVersions: number[]
}

interface ParsedClientDocFrame {
  type: string
  workflowId: string | null
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

function opLabel(op: WireOpEnvelope): string {
  return `${op.op}:${'node_id' in op ? String(op.node_id) : ''}`
}

function baseVersion(op: WireOpEnvelope): number {
  if (!('base_version' in op) || typeof op.base_version !== 'number')
    throw new Error('wire op has no numeric base_version')
  return op.base_version
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
    opsResult: parseWireOps(ops)
  }
}

/** Routed `/ws` host shared by black-box Agent follower fixtures. */
export class AgentFollowerHostSocket {
  private readonly hosts = new Map<string, HostDoc>()
  private readonly pausedSubscribes = new Set<string>()
  private readonly pendingSubscribes = new Map<string, string>()
  private refuseReason: string | null = null
  private refusalsLeft = 0
  private refusedSubscribes = 0

  private socket: WebSocketRoute | null = null
  private subscribes = 0
  private readonly createdAt = Date.now()
  private readonly clientFrames: ClientDocFrame[] = []
  private readonly heldBatches: WireOpEnvelope[][] = []
  private readonly humanOutcomes: ApplyOutcome[] = []
  private resolveSubscribed: (() => void) | null = null
  private readonly subscribed = new Promise<void>((resolve) => {
    this.resolveSubscribed = resolve
  })

  constructor(
    private readonly page: Page,
    private readonly workflowId: string,
    host: HostDoc,
    private readonly socketSid: string,
    private readonly humanOpsHost: HumanOpsHost = 'hold'
  ) {
    this.hosts.set(workflowId, host)
  }

  /** Adds another semantic document served by this routed socket. */
  addWorkflow(workflowId: string, host: HostDoc): void {
    this.hosts.set(workflowId, host)
  }

  /** Holds the next subscribe response so a test can exercise the pre-ack window. */
  pauseSubscribes(workflowId: string): void {
    this.pausedSubscribes.add(workflowId)
  }

  /** Releases a subscribe held by {@link pauseSubscribes}. */
  resumeSubscribe(workflowId: string): void {
    this.pausedSubscribes.delete(workflowId)
    const stateVector = this.pendingSubscribes.get(workflowId)
    if (stateVector === undefined) return
    this.pendingSubscribes.delete(workflowId)
    this.answerSubscribe(workflowId, stateVector)
  }

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

  /** Emits a ComfyUI execution frame on the shared `/ws`. */
  sendExecution(frame: ExecutionHostFrame): void {
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
    this.recordClientFrame(frame)
    if (frame.workflowId === null || !this.hosts.has(frame.workflowId)) {
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
      ops: ops.map((op) => opLabel(op)),
      opIds: ops.map((op) => op.op_id),
      baseVersions: ops.map(baseVersion)
    })
  }

  /** Dispatches a frame already confirmed to target this host's workflow. */
  private routeClientDocFrame(frame: ParsedClientDocFrame): void {
    if (frame.type === 'doc_subscribe' && frame.stateVector !== null) {
      if (this.pausedSubscribes.has(frame.workflowId!)) {
        this.pendingSubscribes.set(frame.workflowId!, frame.stateVector)
        return
      }
      this.answerSubscribe(frame.workflowId!, frame.stateVector)
      return
    }
    if (frame.type === 'doc_ops' && this.humanOpsHost === 'apply') {
      this.judgeHumanOps(frame.workflowId!, frame.opsResult)
      return
    }
    if (frame.type === 'doc_ops' && frame.opsResult.ok) {
      this.heldBatches.push(frame.opsResult.ops)
    }
  }

  /**
   * Every human op a `hold` host is still sitting on, oldest first, for a
   * test inspecting the backlog. To let one of them REACH the document (e.g.
   * after a competing write has claimed the same register), call
   * {@link releaseHeldClientOps} rather than applying these directly: the
   * applier alone skips the relay gate and records no outcome.
   */
  heldClientOps(): WireOpEnvelope[] {
    return this.heldBatches.flat()
  }

  /**
   * Judges and broadcasts the oldest held batch down the same path the
   * `apply` host takes at send time - relay gate, applier, verdict frame,
   * delta - so a released batch is indistinguishable from one judged when it
   * arrived, and its outcomes still reach {@link humanOpOutcomes}. Whole
   * batches only: `opSender` settles an in-flight batch on the first op id it
   * recognises, so releasing part of one would retire all of it.
   */
  releaseHeldClientOps(): WireOpEnvelope[] {
    const batch = this.heldBatches.shift()
    if (!batch) return []
    this.judgeHumanOps(this.workflowId, { ok: true, ops: batch })
    return batch
  }

  /**
   * Make the host REFUSE subscribes, as it does when `docService` is nil,
   * when it is overloaded, or at the per-session document cap. No catch-up
   * follows a refusal, so the follower gets no canvas frame at all.
   *
   * `times` bounds the refusal: a finite count models a transient overload
   * that the follower's own subscribe-retry ladder is meant to ride out, and
   * the default (unbounded) models a host that never recovers.
   */
  refuseSubscribes(
    reason = 'overloaded',
    times = Number.POSITIVE_INFINITY
  ): void {
    this.refuseReason = reason
    this.refusalsLeft = times
  }

  private answerSubscribe(workflowId: string, stateVector: string): void {
    const host = this.hosts.get(workflowId)
    if (!host) return
    if (this.refuseReason !== null && this.refusalsLeft > 0) {
      this.refusalsLeft -= 1
      this.refusedSubscribes += 1
      this.send(host.subscribeRefused(this.refuseReason))
      this.subscribes += 1
      this.resolveSubscribed?.()
      return
    }
    this.send(host.subscribed())
    this.send(host.catchUp(stateVector))
    this.subscribes += 1
    this.resolveSubscribed?.()
  }

  /** Subscribes this host turned away, so a retry ladder can be asserted. */
  refusedSubscribeCount(): number {
    return this.refusedSubscribes
  }

  // The applier is the only judge of a structurally valid human batch; the
  // wire ops reach it in place, exactly as the relay hands them to the host.
  // A batch that failed the envelope check, or that cleared it but is empty
  // or carries a duplicate `op_id`, never reaches the applier at all — the
  // relay itself rejects that frame as `invalid_frame` earlier.
  private judgeHumanOps(workflowId: string, opsResult: ParsedWireBatch): void {
    if (!opsResult.ok) {
      this.send(this.invalidFrameResult(workflowId))
      return
    }
    if (!isValidDocOpsBatch(opsResult.ops)) {
      this.send(this.invalidFrameResult(workflowId))
      return
    }
    const host = this.hosts.get(workflowId)
    if (!host) return
    const { result, update, outcomes } = host.applyWire(opsResult.ops)
    this.humanOutcomes.push(...outcomes)
    this.send(result)
    if (update) this.send(update)
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

  private invalidFrameResult(workflowId: string): HostFrame {
    return {
      type: 'doc_ops_result',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: workflowId,
        ok: false,
        code: 'invalid_frame',
        message: 'doc_ops frame was not structurally valid'
      }
    }
  }

  /** Rises once per follower subscribe, after the catch-up frame was sent. */
  subscribeCount(): number {
    return this.subscribes
  }

  async disconnect(): Promise<void> {
    if (!this.socket) throw new Error('the app has not opened /ws yet')
    await this.socket.close()
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
