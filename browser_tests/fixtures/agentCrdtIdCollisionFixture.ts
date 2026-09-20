/**
 * Repro harness for PM-1251: the frontend (`idAllocation.ts`'s local
 * `++lastNodeId` counter) and the server-side agent independently mint node
 * ids for the SAME bound doc, with no shared reservation. When both mint
 * before observing the other's write, their ops collide on the applier's
 * `["node", id]` register and the production last-write-wins rule
 * (`comfy-multi-player`'s `compareStampKeys`) silently drops one — with no
 * error surfaced to either actor.
 *
 * This is deliberately NOT `agentConversationFixture`: that fixture replays
 * a recording captured against a real backend and only ever calls
 * `HostDoc.apply()` for the agent's own ops (never the frontend's), so it
 * cannot exercise two actors writing the same node id. This harness drives
 * the real Ctrl+D/duplicate-menu path so the frontend mints and sends a real
 * `doc_ops` frame, captures it off the mocked socket, and replays it through
 * the SAME production applier (`HostDoc.applyWireOps`, added for this
 * repro) that a real backend would use — no hand-rolled conflict logic.
 */
import type { Locator, Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'
import { createI18n } from 'vue-i18n'

import type { AgentRunMode, WorkflowListResponse } from '@comfyorg/ingest-types'
import type {
  ApplyOutcome,
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { ObjectInfoResponse } from '@/schemas/nodeDefSchema'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import {
  DOC_PROTOCOL_VERSION,
  parseServerDocFrame
} from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import { mintWireOps } from '@/workbench/extensions/agent/crdt/opEnvelope'

import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { ContextMenu } from '@e2e/fixtures/components/ContextMenu'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockEmptyAgentThreadsList } from '@e2e/fixtures/utils/mockAgentThreadsList'

const WORKFLOW_ID = 'a2f6e9c4-9b7d-4a3d-9e12-pm1251-repro'
/** The one node the doc starts with — duplicating it triggers the collision. */
export const SEED_NODE_ID = '1'
const SUBSCRIBE_TIMEOUT = 15_000
const THREAD_ID = 'e9a2f3d1-7c44-4b2e-9a01-pm1251-repro'
const MESSAGE_ID = 'pm-1251-repro-message-0'
const SEND_LABEL = enMessages.agent.send
// The composer names itself with the rendered message, escapes resolved; the
// app's own i18n module is a Vite build, so this mirrors it over the same
// locale file exactly as `agentConversationFixture.ts` does.
const COMPOSER_LABEL = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global.t('agent.placeholder')

const CATALOG: WidgetCatalog = {
  types: {
    CLIPTextEncode: { widget_order: ['text'] },
    SaveImage: { widget_order: ['filename_prefix'] }
  }
}

/**
 * Real backends serve `/api/object_info` for `LiteGraph.createNode()` to
 * resolve against; `mockCloudBoot`'s `objectInfo: 'server'` skips that route
 * so it can reach a live ComfyUI backend instead, which this repro has none
 * of. This is the minimal, schema-shaped stand-in for the two core node
 * types the repro needs — registered before `bootAgentApp` so it is the
 * only handler for the pattern (see `boot()`).
 */
const OBJECT_INFO: ObjectInfoResponse = {
  CLIPTextEncode: {
    input: {
      required: {
        clip: ['CLIP', {}],
        text: ['STRING', { multiline: true }]
      }
    },
    output: ['CONDITIONING'],
    output_name: ['CONDITIONING'],
    output_node: false,
    name: 'CLIPTextEncode',
    display_name: 'CLIP Text Encode (Prompt)',
    description: '',
    category: 'conditioning',
    python_module: 'nodes'
  },
  SaveImage: {
    input: {
      required: {
        images: ['IMAGE', {}],
        filename_prefix: ['STRING', { default: 'ComfyUI' }]
      }
    },
    output: [],
    output_name: [],
    output_node: true,
    name: 'SaveImage',
    display_name: 'Save Image',
    description: '',
    category: 'image',
    python_module: 'nodes'
  }
}

const SEED: WorkflowJSON = {
  nodes: [
    {
      id: SEED_NODE_ID,
      type: 'CLIPTextEncode',
      pos: [100, 100],
      size: [300, 200],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [
        { name: 'clip', type: 'CLIP', link: null },
        { name: 'text', type: 'STRING', widget: { name: 'text' }, link: null }
      ],
      outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [] }],
      properties: {},
      widgets_values: ['seed node, duplicate me']
    }
  ],
  links: []
}

/** The competing write the agent independently mints for the same id. */
function agentCollisionOp(nodeId: string | number): GraphOperation {
  return {
    op: 'add_node',
    node_id: nodeId,
    class_type: 'SaveImage',
    // Close to the seed's [100, 100] so a fresh reconcile's default viewport
    // frames both in one screenshot, not off past whatever it fits to.
    pos: [100, 350],
    node: {
      id: nodeId,
      type: 'SaveImage',
      pos: [100, 350],
      size: [280, 320],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [{ name: 'images', type: 'IMAGE', link: null }],
      outputs: [],
      properties: {},
      widgets_values: ['ComfyUI']
    }
  }
}

const AGENT_ACTOR = 'agent:comfy:pm-1251-repro'

class IdCollisionHarness {
  readonly panel: Locator
  readonly vueNodes: VueNodeHelpers
  readonly contextMenu: ContextMenu
  readonly topbar: Topbar
  readonly host: HostDoc

  private readonly capturedOps: Op[] = []
  private subscribes = 0

  constructor(readonly page: Page) {
    this.panel = page.locator('#agent-panel-root')
    this.vueNodes = new VueNodeHelpers(page)
    this.contextMenu = new ContextMenu(page)
    this.topbar = new Topbar(page)
    this.host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
  }

  async boot(): Promise<void> {
    await this.mockAgentApi()
    // Registered before `bootAgentApp`'s `objectInfo: 'server'` mode skips
    // its own object_info mock, so this is the only handler for the pattern.
    await this.page.route('**/api/object_info', (route) =>
      route.fulfill(jsonRoute(OBJECT_INFO))
    )
    await this.page.routeWebSocket(/\/ws/, (socket) => {
      socket.onMessage((raw) => this.onClientFrame(socket, raw))
      socket.send(
        JSON.stringify({
          type: 'status',
          data: {
            status: { exec_info: { queue_remaining: 0 } },
            sid: 'pm-1251-repro-sid'
          }
        })
      )
    })
    await bootAgentApp(this.page, true, {
      settings: {
        'Comfy.VueNodes.Enabled': true,
        'Comfy.Graph.CanvasInfo': false
      },
      objectInfo: 'server'
    })
    await this.page
      .getByRole('button', { name: enMessages.agent.entryButton })
      .click()
    await expect(this.panel).toBeVisible({ timeout: 30_000 })
    await this.selectWorkflowTarget()
    // `useAgentSession` only binds the CRDT workflow id (which is what makes
    // the follower's `isTargetActive` watch subscribe) once a turn's POST ack
    // names it — selecting the target alone does not. A real turn is not
    // needed for that binding, so this prompt is never answered.
    await this.sendMinimalPrompt()
    await this.waitForSubscribe(1)
    // The seed's one node materializes from the doc's catch-up frame.
    await expect(this.vueNodes.getNodeLocator(SEED_NODE_ID)).toBeVisible()
  }

  private async waitForSubscribe(count: number): Promise<void> {
    await expect
      .poll(() => this.subscribes, { timeout: SUBSCRIBE_TIMEOUT })
      .toBeGreaterThanOrEqual(count)
  }

  /**
   * Forces a full catch-up reconcile of the doc's CURRENT state — a real
   * tab switch away and back, exactly `agentTabSwitchCatchUp.spec.ts`'s
   * mechanism — rather than relying on the incremental live-update path.
   * PR #17963 (merged 2026-09-18) fixed the incremental path to patch a
   * still-live node in place instead of rebuilding it from the doc on
   * every update, so this repro's wipe/phantom symptom needs the same
   * whole-document reconcile a tab switch (or reconnect) drives, against a
   * doc that now disagrees with the still-live orphan at the collided id.
   */
  async forceReconcile(): Promise<void> {
    const before = this.subscribes
    await this.topbar.newWorkflowButton.click()
    await expect(this.vueNodes.nodes).toHaveCount(0)
    await this.topbar.getTab(0).click()
    await this.waitForSubscribe(before + 1)
  }

  private async sendMinimalPrompt(): Promise<void> {
    const content = 'pm-1251 repro: bind the doc'
    const composer = this.panel.getByRole('textbox', { name: COMPOSER_LABEL })
    await composer.fill(content)
    await this.panel.getByRole('button', { name: SEND_LABEL }).click()
    await expect(this.panel.getByText(content).first()).toBeVisible()
    // `bindWorkflow(ack.workflow_id)` alone only sets the session's own
    // record; `agent_active_tab` is the WS-side event a real turn also sends
    // and what the recorded conversations always send before any graph_ops
    // — sent here so the doc-bound state this repro needs matches a real
    // turn's, not a REST-ack-only approximation of it. The turn is then
    // completed (never answered otherwise) so nothing about it later reads
    // as stuck and unwinds the binding this repro depends on.
    this.sendAgentEvent({
      type: 'agent_active_tab',
      data: { workflow_id: WORKFLOW_ID, name: 'Unsaved Workflow' }
    })
    this.sendAgentEvent({ type: 'agent_message_done', data: {} })
  }

  private sendAgentEvent(event: {
    type: string
    data: Record<string, unknown>
  }): void {
    const stamped = {
      type: event.type,
      data: { ...event.data, message_id: MESSAGE_ID, thread_id: THREAD_ID }
    }
    const parsed = parseAgentWsEvent(stamped)
    if (!parsed.success)
      throw new Error(
        `${event.type} frame is not a valid agent event: ${parsed.error.message}`
      )
    this.send(parsed.data)
  }

  private send(frame: AgentWsEvent): void {
    if (!this.socket) throw new Error('the app has not opened /ws yet')
    this.socket.send(JSON.stringify(frame))
  }

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
      const saved: UserDataFullInfo = {
        path,
        modified: Date.now(),
        size: request.postDataBuffer()?.length ?? 0
      }
      return route.fulfill(jsonRoute(saved))
    })
    await this.page.route('**/api/workflows?*', (route) => {
      const workflows: WorkflowListResponse = {
        data:
          savedName === undefined
            ? []
            : [
                {
                  id: WORKFLOW_ID,
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
      }
      return route.fulfill(jsonRoute(workflows))
    })
    const picker = this.panel.getByRole('button', {
      name: enMessages.agent.switchWorkflow
    })
    await picker.click()
    await this.page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
    await expect(picker).toHaveText('Unsaved Workflow')
  }

  /**
   * Duplicates the seed node through the real "Duplicate" context-menu
   * action (the same path `Ctrl+D`/`LGraphCanvas.pasteFromClipboard` takes),
   * so the id it gets is genuinely minted by `idAllocation.ts`'s local
   * counter, not asserted a priori.
   */
  async duplicateSeedNode(): Promise<{ nodeId: string; op: Op }> {
    const header = this.page.locator(
      `[data-node-id="${SEED_NODE_ID}"] .lg-node-header`
    )
    // The mint gate's doc-bound read (`isBoundWorkflowActive`) can still be
    // settling its own reactivity in the instant right after this harness's
    // send-a-prompt bind step, exactly like a real "bind, then immediately
    // edit" race would — bounded retries here mirror the retry budget
    // `opSender.ts` itself gives a transiently undeliverable send, rather
    // than papering over it with a fixed wait.
    for (let attempt = 0; attempt < 6; attempt++) {
      const before = await this.vueNodes.nodes.count()
      await this.contextMenu.openForVueNode(header)
      await this.contextMenu.clickMenuItemExact('Duplicate')
      await expect(this.vueNodes.nodes).toHaveCount(before + 1)

      const nodeId = await this.page.evaluate(
        (seedId) =>
          window
            .app!.graph.nodes.map((node) => String(node.id))
            .filter((id) => id !== seedId)
            .sort((a, b) => Number(a) - Number(b))
            .at(-1),
        SEED_NODE_ID
      )
      if (!nodeId) throw new Error('duplicate produced no new node id')
      const op = await this.pollForOutboundAddNode(nodeId, 2_000)
      if (op) return { nodeId, op }
      // Paste offsets every duplicate the same way, so a failed attempt's
      // orphan would sit on top of the seed's header for the next retry.
      // Shove it aside (a fixture-setup evaluate, not the action under
      // test) rather than deleting it through the same floating selection
      // toolbox its own header sits under.
      await this.page.evaluate((id) => {
        const node = window.app!.graph.nodes.find(
          (candidate) => String(candidate.id) === id
        )
        if (!node) return
        node.pos[0] += 2000
        node.pos[1] += 2000
        window.app!.graph.setDirtyCanvas(true, true)
      }, nodeId)
    }
    throw new Error(
      'duplicate never produced an outbound add_node op after retries'
    )
  }

  private async pollForOutboundAddNode(
    nodeId: string,
    timeoutMs: number
  ): Promise<Op | undefined> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const op = this.findCapturedAddNode(nodeId)
      if (op) return op
      if (Date.now() >= deadline) return undefined
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  private findCapturedAddNode(nodeId: string): Op | undefined {
    return this.capturedOps.find(
      (op) => op.op === 'add_node' && String(op.node_id) === nodeId
    )
  }

  /**
   * Mints the agent's competing `add_node` at `nodeId` with wire identity
   * (`op_id`/`stamp`) — the same envelope step `opEnvelope.ts` performs for
   * the human write leg — so it carries the SAME shape a real backend would
   * put on the wire for the agent's write.
   */
  mintAgentCollision(nodeId: string | number, baseVersion: number): Op {
    return mintWireOps([agentCollisionOp(nodeId)], {
      actor: AGENT_ACTOR,
      baseVersion
    })[0]
  }

  /**
   * Runs `ops` through the real production applier bound to this repro's
   * doc and returns each op's outcome (`applied`, `lww-dropped`, ...)
   * verbatim — see {@link HostDoc.applyWireOps}.
   */
  applyWireOps(ops: Op[]): { frame: HostFrame; outcomes: ApplyOutcome[] } {
    return this.host.applyWireOps(ops)
  }

  /**
   * Delivers a host frame (e.g. the `HostDoc.applyWireOps` result of the
   * agent's colliding write) to the client over the mocked `/ws`, exactly
   * as a live `doc_update` broadcast would. Skipping this call is how the
   * desync repro withholds the correction the frontend never asked for.
   */
  deliver(frame: HostFrame): void {
    if (!this.socket) throw new Error('the app has not opened /ws yet')
    if (
      (frame.type.startsWith('doc_') || frame.type === 'awareness') &&
      parseServerDocFrame(frame) === null
    )
      throw new Error(`host frame ${frame.type} is not a valid doc frame`)
    this.socket.send(JSON.stringify(frame))
  }

  private socket: WebSocketRoute | null = null

  private async mockAgentApi(): Promise<void> {
    const { page } = this
    await mockEmptyAgentThreadsList(page)
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'POST')
        return route.fulfill(jsonRoute([]))
      // The ack's `workflow_id` is what `useAgentSession` binds for CRDT
      // purposes (`bindWorkflow(ack.workflow_id)`).
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID,
          workflow_id: WORKFLOW_ID
        })
      })
    })
    await page.route('**/api/workflows**', (route) =>
      route.fulfill(
        jsonRoute({
          data: [],
          pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
        })
      )
    )
    // Best-effort background calls the panel makes on mount; none are under
    // test here, but an unmocked one 502s through Vite's dev proxy (there is
    // no real backend behind DEV_SERVER_COMFYUI_URL in this repro) and the
    // panel surfaces that as a toast that can mask the actual assertions.
    const runMode: AgentRunMode = { credit_limit: null, mode: 'ask_approval' }
    await page.route('**/api/agent/run-mode', (route) =>
      route.fulfill(jsonRoute(runMode))
    )
    await page.route('**/api/jobs**', (route) =>
      route.fulfill(
        jsonRoute({
          jobs: [],
          pagination: { offset: 0, limit: 0, total: 0, has_more: false }
        })
      )
    )
    await page.route('**/api/internal/cloud_analytics', (route) =>
      route.fulfill(jsonRoute({}))
    )
    await page.route('**/api/experiment/models', (route) =>
      route.fulfill(jsonRoute([]))
    )
  }

  private onClientFrame(socket: WebSocketRoute, raw: string | Buffer): void {
    this.socket = socket
    const frame: unknown = JSON.parse(raw.toString())
    if (typeof frame !== 'object' || frame === null) return
    const { type, data } = frame as { type?: unknown; data?: unknown }
    if (typeof data !== 'object' || data === null) return
    if (type === 'doc_subscribe') return this.handleDocSubscribe(socket, data)
    if (type === 'doc_ops') return this.handleDocOps(socket, data)
  }

  private handleDocSubscribe(socket: WebSocketRoute, data: object): void {
    const { workflow_id, state_vector_b64 } = data as {
      workflow_id?: unknown
      state_vector_b64?: unknown
    }
    if (workflow_id !== WORKFLOW_ID || typeof state_vector_b64 !== 'string')
      return
    socket.send(JSON.stringify(this.host.subscribed()))
    socket.send(JSON.stringify(this.host.catchUp(state_vector_b64)))
    this.subscribes += 1
  }

  private handleDocOps(socket: WebSocketRoute, data: object): void {
    const { workflow_id, ops } = data as {
      workflow_id?: unknown
      ops?: unknown
    }
    if (!Array.isArray(ops)) return
    this.capturedOps.push(...(ops as Op[]))
    // A real backend acks receipt promptly; `opSender` holds one batch
    // in flight until its `doc_ops_result` (or a 10s silence) before the
    // next queued batch — including this repro's own add_node — ever
    // transmits. This is bookkeeping only: this repro decides collision
    // outcomes later, itself, via `HostDoc.applyWireOps`.
    socket.send(
      JSON.stringify({
        type: 'doc_ops_result',
        data: {
          v: DOC_PROTOCOL_VERSION,
          workflow_id,
          ok: true,
          applied: (ops as Op[]).map((op) => op.op_id),
          skipped: []
        }
      })
    )
  }
}

interface IdCollisionFixtures {
  idCollision: IdCollisionHarness
}

export const idCollisionTest = agentTest.extend<IdCollisionFixtures>({
  idCollision: async ({ page }, use) => {
    const harness = new IdCollisionHarness(page)
    await harness.boot()
    await use(harness)
  }
})
