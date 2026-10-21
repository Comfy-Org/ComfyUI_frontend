import { mergeTests } from '@playwright/test'
import type { Page, WebSocketRoute } from '@playwright/test'
import type { WorkflowJSON } from '@comfyorg/comfy-multi-player'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import {
  agentTest,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import {
  VHS_COMBINE_ID,
  VHS_LOAD_ID,
  VHS_MESSAGE_ID,
  VHS_THREAD_ID,
  VHS_WORKFLOW_ID,
  savedVhsWorkflow,
  vhsCatalog,
  vhsNodeDefs
} from '@e2e/fixtures/data/agent/agentVhsSavedWorkflow'
import { webSocketFixture } from '@e2e/fixtures/ws'

async function registerKvStateRestore(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const type of ['VHS_LoadVideo', 'VHS_VideoCombine']) {
      const proto = window.LiteGraph!.registered_node_types[type].prototype
      const original = proto.onConfigure
      proto.onConfigure = function (info) {
        original?.call(this, info)
        const saved = info.widgets_values as unknown
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return
        for (const widget of this.widgets ?? []) {
          if (Object.hasOwn(saved, widget.name))
            widget.value = (saved as Record<string, never>)[widget.name]
        }
      }
    }
  })
}

/** Canvas state of the saved VHS workflow, with VHS's name-keyed restore stood in. */
export class VhsSavedWorkflowCanvas {
  constructor(private readonly page: Page) {}

  state() {
    return this.page.evaluate(
      ([loadId, combineId]) => {
        const graph = window.app!.graph
        const widget = (id: number, name: string) =>
          graph.nodes
            .find((node) => String(node.id) === String(id))
            ?.widgets?.find((w) => w.name === name)?.value
        return {
          types: graph.nodes.map((node) => node.type).sort(),
          frameLoadCap: widget(loadId, 'frame_load_cap'),
          filenamePrefix: widget(combineId, 'filename_prefix')
        }
      },
      [VHS_LOAD_ID, VHS_COMBINE_ID] as const
    )
  }

  sendAgentOpenedDocument(socket: WebSocketRoute): void {
    const host = new HostDoc(
      VHS_WORKFLOW_ID,
      savedVhsWorkflow() as WorkflowJSON,
      vhsCatalog
    )
    host.quarantineRecordWidgets(VHS_LOAD_ID)
    host.quarantineRecordWidgets(VHS_COMBINE_ID)
    for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))
  }
}

export const test = mergeTests(agentTest, webSocketFixture).extend<{
  vhsCanvas: VhsSavedWorkflowCanvas
}>({
  vhsCanvas: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem('Comfy.Agent.CrdtFollower', 'true')
    })
    await bootAgentApp(page, true, {
      objectInfo: vhsNodeDefs,
      beforeNavigate: async (page) => {
        await mockAgentTurnApi(page, {
          message_id: VHS_MESSAGE_ID,
          thread_id: VHS_THREAD_ID,
          workflow_id: VHS_WORKFLOW_ID
        })
        await mockWorkflowPersistence(page, VHS_WORKFLOW_ID)
      }
    })
    await registerKvStateRestore(page)
    await use(new VhsSavedWorkflowCanvas(page))
  }
})
