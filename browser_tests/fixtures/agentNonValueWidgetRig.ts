import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

interface NonValueWidgetRigConfig {
  catalog: WidgetCatalog
  messageId: string
  nodeDefs: Record<string, ComfyNodeDef>
  samplerNodeId: number
  seed: WorkflowJSON
  socketSid: string
  threadId: string
  visibleNodeId: number
  workflowId: string
}

/** Shared host-backed setup for the non-value-widget browser regressions. */
export class AgentNonValueWidgetRig {
  readonly host: HostDoc
  readonly hostSocket: AgentFollowerHostSocket
  readonly vueNodes: VueNodeHelpers

  private constructor(
    private readonly page: Page,
    private readonly config: NonValueWidgetRigConfig,
    host: HostDoc,
    hostSocket: AgentFollowerHostSocket
  ) {
    this.host = host
    this.hostSocket = hostSocket
    this.vueNodes = new VueNodeHelpers(page)
  }

  static async boot(
    page: Page,
    config: NonValueWidgetRigConfig
  ): Promise<AgentNonValueWidgetRig> {
    const host = new HostDoc(config.workflowId, config.seed, config.catalog)
    const hostSocket = new AgentFollowerHostSocket(
      page,
      config.workflowId,
      host,
      config.socketSid,
      'apply'
    )
    await hostSocket.install()

    await bootAgentApp(page, true, {
      objectInfo: config.nodeDefs,
      settings: { 'Comfy.Graph.CanvasInfo': false },
      beforeNavigate: async (page) => {
        await mockAgentTurnApi(page, {
          message_id: config.messageId,
          thread_id: config.threadId,
          workflow_id: config.workflowId
        })
        await mockWorkflowPersistence(page, config.workflowId)
      }
    })

    const agentPanel = new AgentPanel(page)
    await agentPanel.open()
    await agentPanel.selectWorkflow()
    await agentPanel.sendMessage('hello')
    hostSocket.send({
      type: 'agent_message_done',
      data: { message_id: config.messageId, thread_id: config.threadId }
    })
    await hostSocket.waitForSubscribe()

    const rig = new AgentNonValueWidgetRig(page, config, host, hostSocket)
    await expect(
      rig.vueNodes.getNodeLocator(String(config.visibleNodeId))
    ).toBeVisible()
    return rig
  }

  widgetValue(nodeId: number, name: string): Promise<unknown> {
    return this.page.evaluate(
      ({ nodeId, name }) =>
        window
          .app!.graph.nodes.find((node) => String(node.id) === nodeId)
          ?.widgets?.find((widget) => widget.name === name)?.value,
      { nodeId: String(nodeId), name }
    )
  }

  editSeed(value: number): Promise<void> {
    return this.page.evaluate(
      ({ nodeId, value }) => {
        const node = window.app!.graph.nodes.find(
          (candidate) => String(candidate.id) === nodeId
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === 'seed'
        )
        if (!widget) throw new Error(`Expected a seed widget on node ${nodeId}`)
        widget.value = value
      },
      { nodeId: String(this.config.samplerNodeId), value }
    )
  }

  seedField(): Locator {
    return this.vueNodes
      .getNodeLocator(String(this.config.samplerNodeId))
      .getByLabel('seed', { exact: true })
      .getByRole('spinbutton')
  }
}
