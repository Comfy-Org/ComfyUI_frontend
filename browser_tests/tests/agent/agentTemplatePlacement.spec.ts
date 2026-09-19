import type { Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import type {
  AgentCancelAccepted,
  AgentMessages,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { nextFrame } from '@e2e/fixtures/utils/timing'

// Agent template placement bug:
// when the in-app Comfy Agent inserts a workflow template onto a canvas that
// already has a node on it, the template's nodes land wherever the template's
// own baked-in absolute layout says, with no regard for what is already on
// the canvas or the current viewport. Root cause: prepareNode() in
// src/workbench/extensions/agent/crdt/graphMutations.ts reads payload.pos
// verbatim (`const [x, y] = readPair(payload.pos, [0, 0])`) -- there is no
// bounding-box, viewport, or collision-avoidance logic anywhere in
// src/workbench/extensions/agent/crdt/. This spec drives the real CRDT
// follower and the real canvas, the way the agent-integration-replay
// mechanism does (browser_tests/fixtures/agentConversationFixture.ts), but
// with a hand-built conversation instead of a recording: recording a new
// fixture requires a live Comfy-Org/cloud stack (see
// browser_tests/fixtures/data/agent/README.md), which is unavailable here,
// and the bug is a frontend placement gap independent of what any particular
// recording contains.

const THREAD_ID = 'a1b2c3d4-0000-4000-8000-000000000001'
const MESSAGE_ID = 'a1b2c3d4-0000-4000-8000-000000000002'
const WORKFLOW_ID = 'a1b2c3d4-0000-4000-8000-000000000003'
const WORKFLOW_NAME = 'Image edit'
const SOCKET_SID = 'a1b2c3d4-0000-4000-8000-000000000004'

// Stands in for the node the user just placed (e.g. Load Image) before
// asking the agent to insert a template.
const EXISTING_NODE_ID = 1
const EXISTING_NODE_POS: [number, number] = [200, 200]

// A template's own baked-in absolute layout -- representative of what a
// real template file (e.g. "GPT Image 2.5 Sunburst - Image Edit") carries:
// a handful of nodes laid out relative to each other, at an absolute origin
// that has nothing to do with wherever the user's own canvas content sits.
// Chosen thousands of px from EXISTING_NODE_POS, matching the reported
// symptom ("loads far away from existing node").
const TEMPLATE_NODE_IDS = [101, 102, 103] as const
const TEMPLATE_ORIGIN: [number, number] = [7000, 6500]
const TEMPLATE_NODE_POSITIONS: Record<number, [number, number]> = {
  101: [TEMPLATE_ORIGIN[0], TEMPLATE_ORIGIN[1]],
  102: [TEMPLATE_ORIGIN[0] + 350, TEMPLATE_ORIGIN[1]],
  103: [TEMPLATE_ORIGIN[0] + 700, TEMPLATE_ORIGIN[1]]
}

// A generous notion of "not absurdly far": within a handful of default
// viewport widths of the existing node's bounding box. The bug currently
// lands the template thousands of px past this.
const REASONABLE_PLACEMENT_MARGIN_PX = 2500

function markdownNode(id: number, pos: [number, number], text: string) {
  return {
    id,
    type: 'MarkdownNote',
    pos,
    size: [300, 120],
    mode: 0,
    order: 0,
    flags: {},
    inputs: [],
    outputs: [],
    properties: {},
    widgets_values: [text]
  }
}

const SEED_WORKFLOW = {
  id: WORKFLOW_ID,
  name: WORKFLOW_NAME,
  catalog: { types: { MarkdownNote: { widget_order: ['text'] } } },
  seed: {
    nodes: [
      markdownNode(
        EXISTING_NODE_ID,
        EXISTING_NODE_POS,
        'Existing node (e.g. Load Image) the user just placed'
      )
    ],
    links: []
  }
}

function templateAddNodeOps() {
  return TEMPLATE_NODE_IDS.map((id) => {
    const pos = TEMPLATE_NODE_POSITIONS[id]
    const node = markdownNode(id, pos, `Template node ${id}`)
    return {
      op: 'add_node' as const,
      pos,
      node,
      node_id: id,
      class_type: 'MarkdownNote'
    }
  })
}

// A trimmed, single-turn adaptation of AgentConversationHarness
// (browser_tests/fixtures/agentConversationFixture.ts) driving a hand-built
// conversation instead of a recorded one: same mocked REST + WebSocket
// wiring, same real HostDoc/CRDT apply path, same real canvas.
class TemplatePlacementHarness {
  private readonly host: HostDoc
  private socket: WebSocketRoute | null = null
  private resolveSubscribed: (() => void) | null = null
  private readonly subscribed = new Promise<void>((resolve) => {
    this.resolveSubscribed = resolve
  })

  constructor(private readonly page: Page) {
    this.host = new HostDoc(
      SEED_WORKFLOW.id,
      SEED_WORKFLOW.seed,
      SEED_WORKFLOW.catalog
    )
  }

  async boot(): Promise<void> {
    await this.mockAgentApi()
    await this.page.routeWebSocket(/\/ws/, (socket) => {
      this.socket = socket
      socket.onMessage((raw) => this.onClientFrame(raw))
      socket.send(
        JSON.stringify({
          type: 'status',
          data: {
            status: { exec_info: { queue_remaining: 0 } },
            sid: SOCKET_SID
          }
        })
      )
    })

    await bootAgentApp(this.page, true, {
      settings: {
        'Comfy.VueNodes.Enabled': true,
        'Comfy.Graph.CanvasInfo': false
      }
    })

    await this.page.getByRole('button', { name: 'Ask Comfy Agent' }).click()
    const panel = this.page.locator('#agent-panel-root')
    await expect(panel).toBeVisible({ timeout: 30_000 })
    await this.selectWorkflowTarget()
  }

  // Mirrors AgentConversationHarness.selectWorkflowTarget: the picker
  // re-polls /api/workflows after saving, so the mock has to echo back a
  // matching entry once the save lands or the app decides the target
  // vanished.
  private async selectWorkflowTarget(): Promise<void> {
    let savedName: string | undefined
    await this.page.route('**/api/userdata/*', (route) => {
      const request = route.request()
      const path = decodeURIComponent(
        new URL(request.url()).pathname.split('/userdata/')[1]
      )
      if (request.method() !== 'POST' || !path.startsWith('workflows/'))
        return route.fallback()
      savedName = path.slice('workflows/'.length, -'.json'.length)
      return route.fulfill(
        jsonRoute({
          path,
          modified: Date.now(),
          size: request.postDataBuffer()?.length ?? 0
        })
      )
    })
    await this.page.route('**/api/workflows?*', (route) =>
      route.fulfill(
        jsonRoute({
          data:
            savedName === undefined
              ? []
              : [
                  {
                    id: SEED_WORKFLOW.id,
                    name: savedName,
                    created_at: '2026-09-01T00:00:00Z',
                    updated_at: '2026-09-01T00:00:00Z',
                    created_by: 'test-user-e2e',
                    latest_version: 1
                  }
                ],
          pagination: {
            has_more: false,
            limit: 100,
            offset: 0,
            total: savedName === undefined ? 0 : 1
          }
        })
      )
    )
    const panel = this.page.locator('#agent-panel-root')
    const picker = panel.getByRole('button', { name: 'Switch workflow' })
    await picker.click()
    await this.page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
    await expect(picker).toHaveText('Unsaved Workflow')
  }

  async sendPrompt(content: string): Promise<void> {
    const panel = this.page.locator('#agent-panel-root')
    const composer = panel.getByRole('textbox', { name: /Describe ideas/ })
    await composer.fill(content)
    await panel.getByRole('button', { name: 'Send' }).click()
    await expect(panel.getByText(content).first()).toBeVisible()
  }

  // Switches the agent to the template's tab, then inserts the template's
  // nodes via the real CRDT add_node path, exactly as the cloud agent would
  // when a template tool call runs against a canvas that already has content.
  async insertTemplate(): Promise<void> {
    this.send(
      this.stampEvent({
        type: 'agent_active_tab',
        data: { workflow_id: WORKFLOW_ID, name: WORKFLOW_NAME }
      })
    )
    await this.waitForSubscribe()
    this.send(this.host.apply(templateAddNodeOps()))
    this.send(
      this.stampEvent({
        type: 'agent_message_done',
        data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
      })
    )
  }

  async waitForTurnComplete(): Promise<void> {
    const panel = this.page.locator('#agent-panel-root')
    await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Stop' })).toHaveCount(0)
  }

  private async mockAgentApi(): Promise<void> {
    const { page } = this
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute({ threads: [] }))
    )
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            thread_id: THREAD_ID,
            message_id: MESSAGE_ID,
            workflow_id: WORKFLOW_ID
          })
        })
      }
      const history: AgentMessages = []
      return route.fulfill(jsonRoute(history))
    })
    await page.route('**/api/agent/threads/*/messages/*/cancel', (route) => {
      const cancelled: AgentCancelAccepted = { status: 'cancelling' }
      return route.fulfill(jsonRoute(cancelled))
    })
    await page.route('**/api/workflows**', (route) =>
      route.fulfill(
        jsonRoute({
          data: [],
          pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
        })
      )
    )
  }

  private stampEvent(event: {
    type: string
    data: Record<string, unknown>
  }): AgentWsEvent {
    const stamped = {
      type: event.type,
      data: { ...event.data, message_id: MESSAGE_ID, thread_id: THREAD_ID }
    }
    const parsed = parseAgentWsEvent(stamped)
    if (!parsed.success)
      throw new Error(
        `hand-built ${event.type} frame is not a valid agent event: ${parsed.error.message}`
      )
    return parsed.data
  }

  private send(frame: AgentWsEvent | HostFrame): void {
    if (
      (frame.type.startsWith('doc_') || frame.type === 'awareness') &&
      parseServerDocFrame(frame) === null
    )
      throw new Error(`host frame ${frame.type} is not a valid doc frame`)
    if (!this.socket) throw new Error('the app has not opened /ws yet')
    this.socket.send(JSON.stringify(frame))
  }

  private onClientFrame(raw: string | Buffer): void {
    const frame: unknown = JSON.parse(raw.toString())
    if (typeof frame !== 'object' || frame === null) return
    const { type, data } = frame as { type?: unknown; data?: unknown }
    if (type !== 'doc_subscribe' || typeof data !== 'object' || data === null)
      return
    const { workflow_id, state_vector_b64 } = data as {
      workflow_id?: unknown
      state_vector_b64?: unknown
    }
    if (workflow_id !== WORKFLOW_ID || typeof state_vector_b64 !== 'string')
      return
    this.send(this.host.subscribed())
    this.send(this.host.catchUp(state_vector_b64))
    this.resolveSubscribed?.()
  }

  private waitForSubscribe(): Promise<void> {
    return this.subscribed
  }
}

test.describe(
  'Agent template placement onto a non-empty canvas',
  { tag: ['@cloud', '@agent'] },
  () => {
    // Driven through the real CRDT follower onto a real canvas.
    // Structure first (this part is not expected to be broken): the template
    // materializes, alongside the pre-existing node. test.fail() below marks
    // where the known placement defect starts, per this repo's convention
    // (see browser_tests/tests/groupNode.spec.ts).
    test('positions inserted template nodes relative to the existing node, not at the raw template coordinates', async ({
      page
    }, testInfo) => {
      test.setTimeout(60_000)
      const harness = new TemplatePlacementHarness(page)
      await harness.boot()
      await harness.sendPrompt('Add the Image Edit template to this canvas')
      await harness.insertTemplate()
      await harness.waitForTurnComplete()

      const positions = await page.evaluate((ids: string[]) => {
        const graph = window.app!.graph
        return Object.fromEntries(
          ids.map((id) => [
            id,
            graph.nodes.find((node) => String(node.id) === id)?.pos
          ])
        )
      }, TEMPLATE_NODE_IDS.map(String))

      for (const id of TEMPLATE_NODE_IDS)
        expect(
          positions[id],
          `template node ${id} should be on the canvas`
        ).toBeDefined()

      // Visual proof, from two lenses on the same real canvas.
      //
      // Lens 1: centered on the pre-existing node. The template is nowhere
      // in frame, because it landed thousands of px away.
      await page.evaluate((pos: [number, number]) => {
        const canvas = window.app!.canvas
        canvas.ds.scale = 1
        canvas.ds.offset = [
          window.innerWidth / 2 - pos[0],
          window.innerHeight / 2 - pos[1]
        ]
        canvas.setDirty(true, true)
      }, EXISTING_NODE_POS)
      await nextFrame(page)
      await testInfo.attach('existing-node-viewport.png', {
        body: await page.screenshot(),
        contentType: 'image/png'
      })

      // Lens 2: centered on the template's own baked-in origin. It rendered,
      // but as an island with nothing from the pre-existing graph in sight.
      await page.evaluate((pos: [number, number]) => {
        const canvas = window.app!.canvas
        canvas.ds.scale = 0.5
        canvas.ds.offset = [
          window.innerWidth / 2 / canvas.ds.scale - pos[0],
          window.innerHeight / 2 / canvas.ds.scale - pos[1]
        ]
        canvas.setDirty(true, true)
      }, TEMPLATE_ORIGIN)
      await nextFrame(page)
      await testInfo.attach('template-island-viewport.png', {
        body: await page.screenshot(),
        contentType: 'image/png'
      })

      // Below is the known defect: graphMutations.ts#prepareNode
      // forwards payload.pos verbatim, with no viewport, bounding-box, or
      // collision-avoidance adjustment against what is already on the canvas.
      test.fail()
      for (const id of TEMPLATE_NODE_IDS) {
        const pos = positions[id]!
        const distance = Math.hypot(
          pos[0] - EXISTING_NODE_POS[0],
          pos[1] - EXISTING_NODE_POS[1]
        )
        expect(
          distance,
          `template node ${id} landed ${distance.toFixed(0)}px from the ` +
            `existing node; expected the frontend to keep it within ` +
            `${REASONABLE_PLACEMENT_MARGIN_PX}px instead of forwarding the ` +
            `template's raw absolute coordinates verbatim`
        ).toBeLessThan(REASONABLE_PLACEMENT_MARGIN_PX)
      }
    })
  }
)
