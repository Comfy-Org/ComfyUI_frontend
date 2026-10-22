import { expect, mergeTests } from '@playwright/test'
import type { Page, WebSocketRoute } from '@playwright/test'
import { OPAQUE_WIDGETS_KEY, nodesMap } from '@comfyorg/comfy-multi-player'
import type { WorkflowJSON } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import {
  BLANK_WORKFLOW,
  agentTest,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
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
        const saved: unknown = info.widgets_values
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return
        for (const widget of this.widgets ?? []) {
          const value: unknown = Reflect.get(saved, widget.name)
          if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
          )
            widget.value = value
        }
        Reflect.set(this, 'videopreview', Reflect.get(saved, 'videopreview'))
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
        const node = (id: number) =>
          graph.nodes.find((candidate) => String(candidate.id) === String(id))
        const widget = (id: number, name: string) =>
          node(id)?.widgets?.find((w) => w.name === name)?.value
        const load = node(loadId)
        const preview: unknown = load
          ? Reflect.get(load, 'videopreview')
          : undefined
        const params: unknown =
          preview && typeof preview === 'object'
            ? Reflect.get(preview, 'params')
            : undefined
        return {
          types: graph.nodes.map((candidate) => candidate.type).sort(),
          frameLoadCap: widget(loadId, 'frame_load_cap'),
          filenamePrefix: widget(combineId, 'filename_prefix'),
          previewFilename:
            params && typeof params === 'object'
              ? Reflect.get(params, 'filename')
              : undefined
        }
      },
      [VHS_LOAD_ID, VHS_COMBINE_ID] as const
    )
  }
}

class VhsDocumentHost {
  private readonly outbound: string[] = []
  private doc: Y.Doc | undefined
  private lastUpdate: HostFrame | undefined

  constructor(private readonly socket: WebSocketRoute) {
    socket.onMessage((message) => this.outbound.push(String(message)))
  }

  async subscribed(): Promise<void> {
    await expect
      .poll(() => this.outbound, { timeout: 15_000 })
      .toContainEqual(expect.stringContaining('doc_subscribe'))
  }

  openSavedWorkflow(): void {
    const host = new HostDoc(
      VHS_WORKFLOW_ID,
      savedVhsWorkflow() as WorkflowJSON,
      vhsCatalog
    )
    for (const frame of host.initialSync()) {
      if (frame.type === 'doc_update') {
        const doc = new Y.Doc()
        Y.applyUpdate(doc, decodeUpdate(frame))
        storeRecords(doc, [VHS_LOAD_ID, VHS_COMBINE_ID])
        this.doc = doc
        this.send(frame, Y.encodeStateAsUpdate(doc))
      } else {
        this.socket.send(JSON.stringify(frame))
      }
    }
  }

  replaceRecord(nodeId: number, record: Record<string, unknown>): void {
    const doc = this.doc
    const previous = this.lastUpdate
    if (!doc || !previous) throw new Error('No document has been opened')
    const before = Y.encodeStateVector(doc)
    const node = nodesMap(doc).get(String(nodeId))
    if (!(node instanceof Y.Map)) throw new Error(`No host node ${nodeId}`)
    node.set(OPAQUE_WIDGETS_KEY, record)
    this.send(
      {
        ...previous,
        data: { ...previous.data, seq: Number(previous.data.seq) + 1 }
      },
      Y.encodeStateAsUpdate(doc, before)
    )
  }

  private send(frame: HostFrame, update: Uint8Array): void {
    const sent = {
      ...frame,
      data: {
        ...frame.data,
        op_ids: [],
        update_b64: Buffer.from(update).toString('base64')
      }
    }
    this.lastUpdate = sent
    this.socket.send(JSON.stringify(sent))
  }
}

function storeRecords(doc: Y.Doc, nodeIds: readonly number[]): void {
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
}

function decodeUpdate(frame: HostFrame): Uint8Array {
  const encoded = frame.data.update_b64
  if (typeof encoded !== 'string')
    throw new Error('doc_update frame has no update_b64')
  return Buffer.from(encoded, 'base64')
}

interface VhsAgentSession {
  panel: AgentPanel
  host: VhsDocumentHost
  canvas: VhsSavedWorkflowCanvas
}

export const test = mergeTests(agentTest, webSocketFixture).extend<{
  vhsAgent: VhsAgentSession
}>({
  vhsAgent: async ({ page, getAgentSocket }, use) => {
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
    await loadIntoBootWorkflow(page, BLANK_WORKFLOW)
    const panel = new AgentPanel(page)
    await panel.open()
    const host = new VhsDocumentHost(await getAgentSocket())
    await panel.selectWorkflow()
    await use({ panel, host, canvas: new VhsSavedWorkflowCanvas(page) })
  }
})
