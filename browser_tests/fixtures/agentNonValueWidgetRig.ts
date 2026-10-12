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
import { nextFrame } from '@e2e/fixtures/utils/timing'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

/** Binary WS frame type 3 (`progress_text`): [u32 type][u32 idLen][id][text]. */
export function progressTextFrame(nodeId: string, text: string): Buffer {
  const id = Buffer.from(nodeId, 'utf8')
  const body = Buffer.from(text, 'utf8')
  const frame = Buffer.alloc(8 + id.length + body.length)
  frame.writeUInt32BE(3, 0)
  frame.writeUInt32BE(id.length, 4)
  id.copy(frame, 8)
  body.copy(frame, 8 + id.length)
  return frame
}

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

  /**
   * One execution progress tick on a node, through the ephemeral text-preview
   * widget's real setter.
   */
  async streamProgressText(nodeId: number, text: string): Promise<void> {
    this.hostSocket.sendExecutionBinary(progressTextFrame(String(nodeId), text))
    await nextFrame(this.page)
  }

  /**
   * Clears the live widget's own `serialize` flag to `undefined` while leaving
   * the key present, as a widget built by object spread from a template that
   * never set it does (`{ ...template, serialize: template.serialize }`). The
   * store's registered flag is untouched, so this is the state in which the
   * minter has to fall back to the store rather than read the live `undefined`
   * as "serialize unless told otherwise".
   */
  clearLiveSerializeFlag(nodeId: number, name: string): Promise<void> {
    return this.page.evaluate(
      ({ nodeId, name }) => {
        const node = window.app!.graph.nodes.find(
          (candidate) => String(candidate.id) === nodeId
        )
        const widget = node?.widgets?.find(
          (candidate) => candidate.name === name
        )
        if (!widget) throw new Error(`Expected ${name} on node ${nodeId}`)
        widget.serialize = undefined
        if (!('serialize' in widget)) {
          throw new Error(`serialize stayed absent on ${name}`)
        }
      },
      { nodeId: String(nodeId), name }
    )
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
