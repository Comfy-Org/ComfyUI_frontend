import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type {
  AgentCancelAccepted,
  AgentMessages,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { emptyAgentThreadList } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { AGENT_COMPOSER_LABEL } from '@e2e/fixtures/utils/agentComposerLabel'

// The empty-canvas half of "the agent says it built my workflow and the canvas
// is empty" (PM-2072, Linear; the 2026-10-20 report: nine template nodes
// applied cleanly to the bound tab at y 4850-5930, and the user saw nothing).
//
// ADR-CRDT-PLACEMENT-0035 deliberately does not reposition a batch on an empty
// canvas, so the template keeps the layout its author baked in. The human
// template flow keeps that layout too AND frames it (`app.ts` calls
// `fitView()` for `openSource === 'template'`). The agent flow kept the layout
// and left the camera at the origin, so a template whose own coordinates are
// thousands of px away was delivered correctly and invisibly.
//
// ADR-AGENT-VIEWPORT-0062 is the decision this spec pins: the nodes stay where
// the template put them and the camera moves to them, once, only when the batch
// is the whole canvas and none of it is on screen. Asserted on what the user
// can see — the canvas's visible area against the nodes' own rects — not on
// which function ran.
//
// Driven like browser_tests/tests/agent/agentTemplatePlacement.spec.ts: the
// real CRDT follower and the real canvas, with a hand-built conversation
// rather than a recording, because recording a new fixture needs a live
// Comfy-Org/cloud stack (browser_tests/fixtures/data/agent/README.md).

const THREAD_ID = 'b2c3d4e5-0000-4000-8000-000000000001'
const MESSAGE_ID = 'b2c3d4e5-0000-4000-8000-000000000002'
const WORKFLOW_ID = 'b2c3d4e5-0000-4000-8000-000000000003'
const WORKFLOW_NAME = 'Fresh tab'

// A template's own baked-in absolute layout, far from the origin a fresh tab
// opens at. Representative of a real gallery template: the reported case sat
// at y 4850-5930.
const TEMPLATE_NODE_IDS = [201, 202, 203] as const
const TEMPLATE_ORIGIN: [number, number] = [7000, 6500]
const TEMPLATE_NODE_POSITIONS: Record<number, [number, number]> = {
  201: [TEMPLATE_ORIGIN[0], TEMPLATE_ORIGIN[1]],
  202: [TEMPLATE_ORIGIN[0] + 350, TEMPLATE_ORIGIN[1]],
  203: [TEMPLATE_ORIGIN[0] + 700, TEMPLATE_ORIGIN[1]]
}

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

// The user's tab is empty: they opened a fresh workflow and asked the agent to
// build one.
const SEED_WORKFLOW = {
  id: WORKFLOW_ID,
  name: WORKFLOW_NAME,
  catalog: { types: { MarkdownNote: { widget_order: ['text'] } } },
  seed: { nodes: [], links: [] }
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

class EmptyCanvasFramingHarness {
  private readonly host: HostDoc
  private readonly hostSocket: AgentFollowerHostSocket

  constructor(private readonly page: Page) {
    this.host = new HostDoc(
      SEED_WORKFLOW.id,
      SEED_WORKFLOW.seed,
      SEED_WORKFLOW.catalog
    )
    this.hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, this.host)
  }

  async boot(): Promise<void> {
    await this.mockAgentApi()
    await this.hostSocket.install()

    await bootAgentApp(this.page, true, {
      settings: {
        'Comfy.VueNodes.Enabled': true,
        'Comfy.Graph.CanvasInfo': false
      }
    })

    await new AgentPanel(this.page).open()
    const panel = this.page.locator('#agent-panel-root')
    await expect(panel).toBeVisible({ timeout: 30_000 })
  }

  async sendPrompt(content: string): Promise<void> {
    const panel = this.page.locator('#agent-panel-root')
    const composer = panel.getByRole('textbox', { name: AGENT_COMPOSER_LABEL })
    await composer.fill(content)
    await panel.getByRole('button', { name: 'Send' }).click()
    await expect(panel.getByText(content).first()).toBeVisible()
  }

  async insertTemplate(): Promise<void> {
    this.send(
      this.stampEvent({
        type: 'agent_active_tab',
        data: { workflow_id: WORKFLOW_ID, name: WORKFLOW_NAME }
      })
    )
    await this.hostSocket.waitForSubscribe()
    await this.emptyTheCanvas()
    this.send(this.host.apply(templateAddNodeOps()))
    this.send(
      this.stampEvent({
        type: 'agent_message_done',
        data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
      })
    )
  }

  /**
   * The user's own blank tab, with the camera where a fresh tab leaves it.
   *
   * Asserted rather than assumed: the app boots with the default workflow on
   * the canvas, and a batch landing beside *that* is the populated-canvas case
   * ADR-CRDT-PLACEMENT-0035 already covers. Without this the spec silently
   * measures the wrong scenario — it did, and the template's nodes came back
   * translated to [1660, 110].
   */
  private async emptyTheCanvas(): Promise<void> {
    await this.page.evaluate(() => {
      const app = window.app!
      app.graph.clear()
      app.canvas.ds.offset[0] = 0
      app.canvas.ds.offset[1] = 0
      app.canvas.ds.scale = 1
      app.canvas.setDirty(true, true)
    })
    await expect
      .poll(() => this.page.evaluate(() => window.app!.graph.nodes.length), {
        message: 'the canvas must be empty before the agent batch arrives'
      })
      .toBe(0)
  }

  async waitForTurnComplete(): Promise<void> {
    const panel = this.page.locator('#agent-panel-root')
    await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Stop' })).toHaveCount(0)
  }

  private async mockAgentApi(): Promise<void> {
    const { page } = this
    await page.route('**/api/agent/threads?*', (route) =>
      route.fulfill(jsonRoute(emptyAgentThreadList()))
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
    this.hostSocket.send(frame)
  }
}

/** Every node id, with whether its rect overlaps the canvas's visible area. */
async function nodeVisibility(
  page: Page,
  ids: readonly number[]
): Promise<Record<string, boolean | null>> {
  return page.evaluate((nodeIds: string[]) => {
    const app = window.app!
    const [vx, vy, vw, vh] = Array.from(app.canvas.ds.visible_area)
    return Object.fromEntries(
      nodeIds.map((id) => {
        const node = app.graph.nodes.find((n) => String(n.id) === id)
        if (!node) return [id, null]
        const [x, y] = node.pos
        const [w, h] = node.size
        const onScreen = x < vx + vw && vx < x + w && y < vy + vh && vy < y + h
        return [id, onScreen]
      })
    )
  }, ids.map(String))
}

test.describe(
  'Agent batch on an empty canvas',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('brings the inserted nodes into view without moving them', async ({
      page
    }, testInfo) => {
      test.setTimeout(60_000)
      const harness = new EmptyCanvasFramingHarness(page)
      await harness.boot()
      await harness.sendPrompt('Build me an image edit workflow')
      await harness.insertTemplate()
      await harness.waitForTurnComplete()

      // The nodes arrived, and at the template's own coordinates: this
      // decision moves the camera, never the batch.
      const positions = await page.evaluate((ids: string[]) => {
        const graph = window.app!.graph
        return Object.fromEntries(
          ids.map((id) => [
            id,
            graph.nodes.find((node) => String(node.id) === id)?.pos
          ])
        )
      }, TEMPLATE_NODE_IDS.map(String))
      for (const id of TEMPLATE_NODE_IDS) {
        expect(
          positions[id],
          `template node ${id} should be on the canvas`
        ).toBeDefined()
        expect(
          Array.from(positions[id] as ArrayLike<number>),
          `template node ${id} must keep the template's own coordinates`
        ).toEqual(TEMPLATE_NODE_POSITIONS[id])
      }

      // What the user can see. The camera animation is 350ms, so poll.
      await expect
        .poll(async () => nodeVisibility(page, TEMPLATE_NODE_IDS), {
          message:
            'the agent built the workflow onto an empty canvas and left the ' +
            'camera at the origin, so the user is looking at a canvas that ' +
            'is not empty and appears to be',
          timeout: 10_000
        })
        .toEqual(
          Object.fromEntries(TEMPLATE_NODE_IDS.map((id) => [String(id), true]))
        )

      await testInfo.attach('framed-batch.png', {
        body: await page.screenshot(),
        contentType: 'image/png'
      })
    })
  }
)
