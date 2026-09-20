import type { Page, WebSocketRoute } from '@playwright/test'

import {
  DOC_PROTOCOL_VERSION,
  parseServerDocFrame
} from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import type { HostDoc, HostFrame } from '@e2e/fixtures/agentConversationHostDoc'

const SUBSCRIBE_TIMEOUT = 15_000

/**
 * How the routed host answers `doc_subscribe`.
 *
 * `refuse` is the server's real refusal shape — ingest answers `overloaded`
 * when it cannot queue the subscribe for the worker, `unsupported` when the
 * document surface is absent, and there is a per-session document cap. The
 * follower cannot distinguish those from the outside, so one knob covers all
 * three. Without this the refusal path is unreachable from a black-box test:
 * it is decided entirely inside the host, never by anything the page does.
 */
export type SubscribeBehavior =
  | { kind: 'accept' }
  | { kind: 'refuse'; code: string; message?: string }

/** Routed `/ws` host shared by black-box Agent follower fixtures. */
export class AgentFollowerHostSocket {
  private socket: WebSocketRoute | null = null
  private subscribes = 0
  private subscribeAttempts = 0
  private behavior: SubscribeBehavior = { kind: 'accept' }
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

  /**
   * Change how the next `doc_subscribe` is answered. Applies to every
   * subsequent attempt, including the follower's own retries, so a test can
   * hold the refusal past the client's retry budget or lift it mid-flight to
   * assert recovery.
   */
  setSubscribeBehavior(behavior: SubscribeBehavior): void {
    this.behavior = behavior
  }

  /**
   * Every `doc_subscribe` the follower sent, accepted or refused.
   *
   * Distinct from {@link subscribeCount}, which only counts the ones that
   * produced a catch-up: under refusal that stays 0 while this one climbs with
   * each retry, which is the only way to tell "gave up" from "still trying".
   */
  subscribeAttemptCount(): number {
    return this.subscribeAttempts
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

  /**
   * The state vector of a `doc_subscribe` addressed to this workflow, or null
   * for any other frame. Split out so {@link onClientFrame} stays a two-branch
   * dispatch rather than growing a validation ladder alongside it.
   */
  private subscribeStateVector(raw: string | Buffer): string | null {
    const frame: unknown = JSON.parse(raw.toString())
    if (typeof frame !== 'object' || frame === null) return null
    const { type, data } = frame as { type?: unknown; data?: unknown }
    if (type !== 'doc_subscribe' || typeof data !== 'object' || data === null)
      return null
    const { workflow_id, state_vector_b64 } = data as {
      workflow_id?: unknown
      state_vector_b64?: unknown
    }
    if (workflow_id !== this.workflowId || typeof state_vector_b64 !== 'string')
      return null
    return state_vector_b64
  }

  private refuseSubscribe(
    refusal: Extract<SubscribeBehavior, { kind: 'refuse' }>
  ): void {
    this.send({
      type: 'doc_subscribed',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: this.workflowId,
        ok: false,
        code: refusal.code,
        ...(refusal.message !== undefined && { message: refusal.message })
      }
    })
  }

  private acceptSubscribe(stateVectorB64: string): void {
    this.send(this.host.subscribed())
    this.send(this.host.catchUp(stateVectorB64))
    this.subscribes += 1
    this.resolveSubscribed?.()
  }

  private onClientFrame(raw: string | Buffer): void {
    const stateVectorB64 = this.subscribeStateVector(raw)
    if (stateVectorB64 === null) return
    this.subscribeAttempts += 1
    if (this.behavior.kind === 'refuse') this.refuseSubscribe(this.behavior)
    else this.acceptSubscribe(stateVectorB64)
  }

  /** Rises once per follower subscribe, after the catch-up frame was sent. */
  subscribeCount(): number {
    return this.subscribes
  }
}
