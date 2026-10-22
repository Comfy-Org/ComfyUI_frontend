import { mergeTests } from '@playwright/test'
import type { Page, WebSocketRoute } from '@playwright/test'
import { OPAQUE_WIDGETS_KEY, nodesMap } from '@comfyorg/comfy-multi-player'
import type { WorkflowJSON } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
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

function quarantineRecordWidgets(
  frames: HostFrame[],
  nodeIds: readonly number[]
): HostFrame[] {
  return frames.map((frame) => {
    if (frame.type !== 'doc_update') return frame
    const doc = new Y.Doc()
    Y.applyUpdate(doc, Buffer.from(String(frame.data.update_b64), 'base64'))
    doc.transact(() => {
      for (const nodeId of nodeIds) {
        const node = nodesMap(doc).get(String(nodeId))
        const widgets = node?.get('widgets')
        if (!(node instanceof Y.Map) || !(widgets instanceof Y.Map)) {
          throw new Error(`Host node ${String(nodeId)} has no named widget map`)
        }
        const record = widgets.toJSON()
        node.delete('widgets')
        node.set(OPAQUE_WIDGETS_KEY, record)
      }
    })
    const update = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')
    doc.destroy()
    return { ...frame, data: { ...frame.data, update_b64: update } }
  })
}

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

class VhsSavedWorkflowCanvas {
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
    const frames = quarantineRecordWidgets(host.initialSync(), [
      VHS_LOAD_ID,
      VHS_COMBINE_ID
    ])
    for (const frame of frames) socket.send(JSON.stringify(frame))
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
