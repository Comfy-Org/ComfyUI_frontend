import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type {
  AgentCancelAccepted,
  AgentMessages,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { emptyAgentThreadList } from '@e2e/fixtures/data/agent/agentThreadList'
import { AGENT_COMPOSER_LABEL } from '@e2e/fixtures/utils/agentComposerLabel'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const THREAD_ID = 'b2c3d4e5-0000-4000-8000-000000000001'
const MESSAGE_ID = 'b2c3d4e5-0000-4000-8000-000000000002'
const WORKFLOW_ID = 'b2c3d4e5-0000-4000-8000-000000000003'
const WORKFLOW_NAME = 'Fresh tab'

const TEMPLATE_ORIGIN: [number, number] = [7000, 6500]

/** The template's own baked-in absolute layout, far from a fresh tab's origin. */
export const TEMPLATE_NODE_POSITIONS: Record<number, [number, number]> = {
  201: [TEMPLATE_ORIGIN[0], TEMPLATE_ORIGIN[1]],
  202: [TEMPLATE_ORIGIN[0] + 350, TEMPLATE_ORIGIN[1]],
  203: [TEMPLATE_ORIGIN[0] + 700, TEMPLATE_ORIGIN[1]]
}

export const TEMPLATE_NODE_IDS = [201, 202, 203] as const

const SEED_WORKFLOW = {
  id: WORKFLOW_ID,
  name: WORKFLOW_NAME,
  catalog: { types: { MarkdownNote: { widget_order: ['text'] } } },
  seed: { nodes: [], links: [] }
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

/** Reports whether each node overlaps the uncovered canvas panel. */
export async function nodeVisibility(
  page: Page,
  ids: readonly number[]
): Promise<Record<string, boolean | null>> {
  return page.evaluate((nodeIds: string[]) => {
    const app = window.app!
    const { ds } = app.canvas
    const panel = document.querySelector('.graph-canvas-panel')
    if (!panel) throw new Error('the graph canvas panel is not rendered')
    const canvasRect = ds.element.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const [vx, vy] = ds.convertCanvasToOffset([
      panelRect.left - canvasRect.left,
      panelRect.top - canvasRect.top
    ])
    const vw = panelRect.width / ds.scale
    const vh = panelRect.height / ds.scale
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

export async function nodePositions(
  page: Page,
  ids: readonly number[]
): Promise<Record<string, [number, number] | null>> {
  return page.evaluate((nodeIds: string[]) => {
    const graph = window.app!.graph
    return Object.fromEntries(
      nodeIds.map((id) => {
        const pos = graph.nodes.find((node) => String(node.id) === id)?.pos
        return [id, pos ? [pos[0], pos[1]] : null]
      })
    )
  }, ids.map(String))
}

class AgentEmptyCanvasFramingHarness {
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
      settings: { 'Comfy.Graph.CanvasInfo': false }
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

export const agentEmptyCanvasFramingTest = agentTest.extend<{
  agentEmptyCanvasFraming: AgentEmptyCanvasFramingHarness
}>({
  agentEmptyCanvasFraming: async ({ page }, use) => {
    const harness = new AgentEmptyCanvasFramingHarness(page)
    await harness.boot()
    await use(harness)
  }
})
