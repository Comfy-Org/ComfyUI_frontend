import type { Page, WebSocketRoute } from '@playwright/test'

import type { Op } from '@comfyorg/comfy-multi-player'

import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import type { HostDoc, HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { parseClientDocFrame } from '@e2e/fixtures/utils/clientDocFrames'

const SUBSCRIBE_TIMEOUT = 15_000

export interface AgentFollowerHostSocketOptions {
  /**
   * Called with each validated client `doc_ops` batch before the host
   * applies it. Return `true` to take the batch over: the host neither
   * applies nor acks it, leaving the caller to decide when, in what order,
   * and against which competing writes it reaches the document. Anything
   * else keeps the default apply-and-broadcast path.
   *
   * This is the seam for scenarios that need different `doc_ops` TIMING
   * (e.g. holding a write back so another can land on the same register
   * first) without a second socket host to keep in step with this one.
   */
  captureClientOps?: (ops: Op[]) => boolean | void
}

/** Routed `/ws` host shared by black-box Agent follower fixtures. */
export class AgentFollowerHostSocket {
  private socket: WebSocketRoute | null = null
  private subscribes = 0
  private resolveSubscribed: (() => void) | null = null
  private readonly subscribed = new Promise<void>((resolve) => {
    this.resolveSubscribed = resolve
  })

  constructor(
    private readonly page: Page,
    private readonly workflowId: string,
    private readonly host: HostDoc,
    private readonly socketSid: string,
    private readonly options: AgentFollowerHostSocketOptions = {}
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
    if (frame === null || frame.workflowId !== this.workflowId) return
    if (frame.type === 'doc_ops') this.onClientOps(frame.ops)
    else this.onClientSubscribe(frame.stateVectorB64)
  }

  // The batch arrives structurally validated; the applier judges the rest.
  private onClientOps(ops: Op[]): void {
    if (this.options.captureClientOps?.(ops) === true) return
    for (const hostFrame of this.host.applyClient(ops)) this.send(hostFrame)
  }

  private onClientSubscribe(stateVectorB64: string): void {
    this.send(this.host.subscribed())
    this.send(this.host.catchUp(stateVectorB64))
    this.subscribes += 1
    this.resolveSubscribed?.()
  }

  /** Rises once per follower subscribe, after the catch-up frame was sent. */
  subscribeCount(): number {
    return this.subscribes
  }
}
