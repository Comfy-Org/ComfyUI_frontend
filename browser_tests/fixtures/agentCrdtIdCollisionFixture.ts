/**
 * Repro harness for the silent last-write-wins drop: when two writes land on
 * the SAME node id, `comfy-multi-player`'s applier resolves the shared
 * `["node", id]` register as pure last-write-wins over
 * `(base_version, actor, op_id)` and drops the loser with no error surfaced
 * to either actor.
 *
 * It is NOT a repro of an id-allocation race, and it does not race two
 * independently chosen ids. A root graph bound to the agent's doc now mints
 * from a disjoint range (`idAllocation.ts`'s `'crdt-disjoint'` mode), so a
 * frontend-minted id can no longer collide with an agent mint by accident.
 * This harness therefore FORCES the collision: it drives the real duplicate
 * action, captures the disjoint id the frontend actually minted off its own
 * outbound `doc_ops` frame, and mints the agent's competing write AT THAT
 * SAME ID so both writes reach the one register. What is under test is what
 * the applier and the two actors do next — which remains unfixed.
 *
 * It is deliberately not built on `agentConversationFixture`: that fixture
 * replays a recording captured against a real backend and only ever calls
 * `HostDoc.apply()` for the agent's own ops (never the frontend's), so it
 * cannot exercise two actors writing one node id. Transport is nonetheless
 * the shared `AgentFollowerHostSocket` in its `'hold'` mode, which keeps the
 * frontend's batch in flight until this repro decides its fate; only the
 * collision orchestration below is specific to this repro, and both writes
 * go through the production applier (`HostDoc.applyWire`), never a
 * hand-rolled conflict rule.
 */
import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { createI18n } from 'vue-i18n'

import type {
  AgentRunMode,
  AgentThreadListResponse,
  AgentTurnAccepted,
  JobsListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ObjectInfoResponse } from '@/schemas/nodeDefSchema'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import { mintWireOps } from '@/workbench/extensions/agent/crdt/opEnvelope'

import {
  agentTest,
  bootAgentApp,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import type {
  HostFrame,
  WireApplyResult
} from '@e2e/fixtures/agentConversationHostDoc'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import type { WireOpEnvelope } from '@e2e/fixtures/agentWireFrame'
import { ContextMenu } from '@e2e/fixtures/components/ContextMenu'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const WORKFLOW_ID = 'a2f6e9c4-9b7d-4a3d-9e12-idcollision01'
/** The one node the doc starts with — duplicating it triggers the collision. */
const SEED_NODE_ID = '1'
const SUBSCRIBE_TIMEOUT = 15_000
const THREAD_ID = 'e9a2f3d1-7c44-4b2e-9a01-idcollision01'
const MESSAGE_ID = 'id-collision-repro-message-0'
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

/** The competing write, minted at an id the frontend already claimed. */
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

const AGENT_ACTOR = 'agent:comfy:id-collision-repro'

export class IdCollisionHarness {
  readonly panel: Locator
  readonly vueNodes: VueNodeHelpers
  readonly contextMenu: ContextMenu
  readonly topbar: Topbar
  readonly host: HostDoc

  private readonly hostSocket: AgentFollowerHostSocket

  constructor(readonly page: Page) {
    this.panel = page.locator('#agent-panel-root')
    this.vueNodes = new VueNodeHelpers(page)
    this.contextMenu = new ContextMenu(page)
    this.topbar = new Topbar(page)
    this.host = new HostDoc(WORKFLOW_ID, SEED, CATALOG)
    // `'hold'`: what this scenario needs from the transport is only different
    // `doc_ops` timing. The frontend's own batch stays in flight, unapplied
    // and unacked, so the agent's competing write can reach the shared
    // register first and `applyWire` below can then report the real outcome
    // of each. A real backend never acks sooner than that either.
    this.hostSocket = new AgentFollowerHostSocket(
      page,
      WORKFLOW_ID,
      this.host,
      'id-collision-repro-sid',
      'hold'
    )
  }

  async boot(): Promise<void> {
    await this.mockAgentApi()
    // Registered before `bootAgentApp`'s `objectInfo: 'server'` mode skips
    // its own object_info mock, so this is the only handler for the pattern.
    await this.page.route('**/api/object_info', (route) =>
      route.fulfill(jsonRoute(OBJECT_INFO))
    )
    await this.hostSocket.install()
    await bootAgentApp(this.page, true, {
      settings: {
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
      .poll(() => this.hostSocket.subscribeCount(), {
        timeout: SUBSCRIBE_TIMEOUT
      })
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
   *
   * `waitForSubscribe` only proves the host sent `doc_subscribed` plus
   * catch-up, not that the client finished reconciling from it, but that is
   * still safe here: rebinding on tab activation (`ecsFollowerAdapter.ts`'s
   * `bind()`) always arms `reconcileNextFrame` for the fresh session, so the
   * very next `doc_update` — this catch-up frame, even an empty one — forces
   * a full reconcile regardless of the delta's size. Callers still assert
   * on the resulting DOM through Playwright's own auto-retrying `expect`,
   * which is what actually waits out any remaining latency.
   */
  async forceReconcile(): Promise<void> {
    const before = this.hostSocket.subscribeCount()
    await this.topbar.newWorkflowButton.click()
    await expect(this.vueNodes.nodes).toHaveCount(0)
    await this.topbar.getTab(0).click()
    await this.waitForSubscribe(before + 1)
  }

  private async sendMinimalPrompt(): Promise<void> {
    const content = 'id-collision repro: bind the doc'
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
    this.hostSocket.send(parsed.data)
  }

  private async selectWorkflowTarget(): Promise<void> {
    await mockWorkflowPersistence(this.page, WORKFLOW_ID)
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
   * so the id it returns is the one `idAllocation.ts` genuinely minted for a
   * doc-bound graph — a `'crdt-disjoint'` id, read back off the app's own
   * outbound `doc_ops` frame rather than assumed a priori. That id is what
   * the agent's write is then aimed at, which is how the same-id collision
   * is forced without inventing an id neither actor would have produced.
   */
  async duplicateSeedNode(): Promise<{
    nodeId: string
    op: WireOpEnvelope
  }> {
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
      const idsBefore = new Set(
        await this.page.evaluate(() =>
          window.app!.graph.nodes.map((node) => String(node.id))
        )
      )
      await this.contextMenu.openForVueNode(header)
      await this.contextMenu.clickMenuItemExact('Duplicate')
      await expect(this.vueNodes.nodes).toHaveCount(before + 1)

      // `'crdt-disjoint'` mint ids are unordered random values, not a
      // sequential counter, so the new node can't be found by numeric
      // magnitude (the highest id may be a stale orphan from a prior
      // attempt) — only by which id wasn't there before.
      const nodeId = await this.page.evaluate(
        (idsBeforeArray) => {
          const before = new Set(idsBeforeArray)
          return window
            .app!.graph.nodes.map((node) => String(node.id))
            .find((id) => !before.has(id))
        },
        [...idsBefore]
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
  ): Promise<WireOpEnvelope | undefined> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const op = this.findCapturedAddNode(nodeId)
      if (op) return op
      if (Date.now() >= deadline) return undefined
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  private findCapturedAddNode(nodeId: string): WireOpEnvelope | undefined {
    return this.hostSocket
      .heldClientOps()
      .find(
        (op) =>
          op.op === 'add_node' &&
          'node_id' in op &&
          String(op.node_id) === nodeId
      )
  }

  /**
   * Mints the agent's competing `add_node` at `nodeId` with wire identity
   * (`op_id`/`stamp`) — the same envelope step `opEnvelope.ts` performs for
   * the human write leg — so it carries the SAME shape a real backend would
   * put on the wire for the agent's write.
   *
   * `nodeId` is deliberately the id the frontend ALREADY minted, with a
   * `baseVersion` chosen so the agent's write wins the register. Nothing
   * about it models an allocation race: disjoint-range minting means the two
   * actors no longer arrive at one id on their own, so the same-id write
   * that remains worth testing has to be forced. What it pins is the
   * unfixed behavior downstream of that write — two writes to one node id
   * resolving via silent last-write-wins, with no error to either side.
   * `driveCollision` below is where both specs share this forced setup.
   */
  mintAgentCollision(
    nodeId: string | number,
    baseVersion: number
  ): WireOpEnvelope {
    return mintWireOps([agentCollisionOp(nodeId)], {
      actor: AGENT_ACTOR,
      baseVersion
    })[0]
  }

  /**
   * Runs `ops` through the real production applier bound to this repro's
   * doc — the same `HostDoc.applyWire` the shared host's `'apply'` mode
   * uses — and returns its verdict (`result`, `update`, per-op `outcomes`)
   * verbatim, including a `lww-dropped` loser. A batch the client itself
   * sent is acked with that real verdict now, which is the only moment a
   * real backend could have acked it either.
   */
  applyWire(ops: WireOpEnvelope[]): WireApplyResult {
    const applied = this.host.applyWire(ops)
    const heldOpIds = new Set(
      this.hostSocket.heldClientOps().map((op) => op.op_id)
    )
    if (ops.some((op) => heldOpIds.has(op.op_id))) this.deliver(applied.result)
    return applied
  }

  /**
   * Delivers a host frame (e.g. the `doc_update` `HostDoc.applyWire`
   * produced for the agent's colliding write) over the mocked `/ws`, exactly
   * as a live `doc_update` broadcast would. Skipping this call is how the
   * desync repro withholds the correction the frontend never asked for.
   */
  deliver(frame: HostFrame): void {
    this.hostSocket.send(frame)
  }

  private async mockAgentApi(): Promise<void> {
    const { page } = this
    const threads: AgentThreadListResponse = {
      threads: [],
      pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
    }
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute(threads))
    )
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'POST')
        return route.fulfill(jsonRoute([]))
      // The ack's `workflow_id` is what `useAgentSession` binds for CRDT
      // purposes (`bindWorkflow(ack.workflow_id)`). `workflow_id` is an
      // extra beyond the generated `AgentTurnAccepted`, handled deliberately
      // elsewhere via `zAgentTurnAccepted...passthrough()`.
      const accepted = {
        thread_id: THREAD_ID,
        message_id: MESSAGE_ID,
        workflow_id: WORKFLOW_ID
      } satisfies AgentTurnAccepted & { workflow_id: string }
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify(accepted)
      })
    })
    await page.route('**/api/workflows**', (route) => {
      const workflows: WorkflowListResponse = {
        data: [],
        pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
      }
      return route.fulfill(jsonRoute(workflows))
    })
    // Best-effort background calls the panel makes on mount; none are under
    // test here, but an unmocked one 502s through Vite's dev proxy (there is
    // no real backend behind DEV_SERVER_COMFYUI_URL in this repro) and the
    // panel surfaces that as a toast that can mask the actual assertions.
    const runMode: AgentRunMode = { credit_limit: null, mode: 'ask_approval' }
    await page.route('**/api/agent/run-mode', (route) =>
      route.fulfill(jsonRoute(runMode))
    )
    await page.route('**/api/jobs**', (route) => {
      const jobs: JobsListResponse = {
        jobs: [],
        pagination: { offset: 0, limit: 0, total: 0, has_more: false }
      }
      return route.fulfill(jsonRoute(jobs))
    })
    await page.route('**/api/internal/cloud_analytics', (route) =>
      route.fulfill(jsonRoute({}))
    )
    await page.route('**/api/experiment/models', (route) =>
      route.fulfill(jsonRoute([]))
    )
  }
}

/**
 * `WireOpEnvelope` claims only `op`/`op_id`; a real wire op also carries
 * `base_version` (`applyOps`'s own `validateEnvelope` enforces it), read here
 * so the agent's competing write can out-rank the frontend's on the shared
 * register — the same advisory read `HostDoc`'s `advisoryActor` makes for the
 * broadcast frame's actor.
 */
function baseVersionOf(op: WireOpEnvelope): number {
  const baseVersion = 'base_version' in op ? op.base_version : undefined
  if (typeof baseVersion !== 'number' || !Number.isInteger(baseVersion))
    throw new Error(
      `captured op ${op.op_id} carries no integer base_version: ${String(baseVersion)}`
    )
  return baseVersion
}

/**
 * Drives the real duplicate action, then aims the agent's write at the id
 * that duplicate minted and applies both through the production applier (see
 * `mintAgentCollision`'s doc for why the same-id write is forced rather than
 * raced) — the setup both `agentNodeIdCollision.spec.ts` tests need before
 * diverging into their own bug-specific assertion. Its `expect`s run here,
 * before either caller reaches its own `test.fail()`: Playwright's
 * `test.fail()` only reclassifies an error thrown AFTER it is called, not
 * one thrown before, so a genuine setup or fixture regression in this
 * shared step still fails the run rather than being swallowed by the
 * expected failure that follows.
 */
export async function driveCollision(idCollision: IdCollisionHarness) {
  const { nodeId, op: humanOp } = await idCollision.duplicateSeedNode()
  expect(nodeId).not.toBe(SEED_NODE_ID)

  // The agent's competing `add_node` is minted at the SAME id the frontend
  // just minted, with a higher base_version so it deterministically wins the
  // LWW register regardless of arrival order — in production the two writes
  // reach the register in no guaranteed order either way.
  const agentOp = idCollision.mintAgentCollision(
    nodeId,
    baseVersionOf(humanOp) + 1
  )
  const agentApply = idCollision.applyWire([agentOp])
  expect(agentApply.outcomes).toEqual([
    { op_id: agentOp.op_id, outcome: 'applied' }
  ])
  const agentUpdate = agentApply.update
  if (agentUpdate === null)
    throw new Error('the agent write applied but produced no doc delta')

  // The human's own write reaches the SAME production applier second and
  // loses the register it shares with the agent's write, silently — the
  // behavior under test, reproduced against the real conflict-resolution
  // code rather than asserted by narration.
  const humanApply = idCollision.applyWire([humanOp])
  expect(humanApply.outcomes).toEqual([
    { op_id: humanOp.op_id, outcome: 'lww-dropped' }
  ])

  return { nodeId, humanOp, agentApply, agentUpdate, humanApply }
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
