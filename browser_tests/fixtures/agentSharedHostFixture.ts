import type { Page } from '@playwright/test'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'

/** A single fake document host reached through one independently routed socket per page. */
export class AgentSharedHostFixture {
  readonly host: HostDoc
  private readonly sockets: AgentFollowerHostSocket[] = []

  constructor(
    private readonly workflowId: string,
    seed: WorkflowJSON,
    catalog: WidgetCatalog
  ) {
    this.host = new HostDoc(workflowId, seed, catalog)
  }

  async attach(page: Page, socketSid: string): Promise<void> {
    const socket = new AgentFollowerHostSocket(
      page,
      this.workflowId,
      this.host,
      socketSid,
      'apply',
      (frame) => this.broadcast(frame)
    )
    this.sockets.push(socket)
    await socket.install()
  }

  broadcast(frame: AgentWsEvent | HostFrame): void {
    for (const socket of this.sockets) socket.send(frame)
  }

  async waitForSubscribers(): Promise<void> {
    await Promise.all(this.sockets.map((socket) => socket.waitForSubscribe()))
  }

  pushAgentOps(operations: Parameters<HostDoc['apply']>[0]): void {
    this.broadcast(this.host.apply(operations))
  }
}
