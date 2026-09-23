import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'
import type { ApplyOutcome } from '@comfyorg/comfy-multi-player'
import { z } from 'zod'

import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { ObjectInfoResponse } from '@/schemas/nodeDefSchema'
import { toNodeId } from '@/types/nodeId'
import type {
  AgentCancelAccepted,
  AgentMessages,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest,
  bootAgentApp,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import type {
  ClientDocFrame,
  HumanOpsHost
} from '@e2e/fixtures/agentFollowerHostSocket'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { TestIds } from '@e2e/fixtures/selectors'
import type {
  AgentConversation,
  AgentConversationTurn,
  RecordedGraphOperation,
  RecordedWsEvent
} from '@e2e/fixtures/data/agent/agentConversation'
import { loadAgentConversation } from '@e2e/fixtures/data/agent/agentConversation'
import { agentHumanAddBlueprint } from '@e2e/fixtures/data/agent/agentHumanAddBlueprints'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import type { ExpectedTurn } from '@e2e/fixtures/data/agent/agentConversationExpectations'
import { RECORDED_EXPECTATIONS } from '@e2e/fixtures/data/agent/agentConversationExpectations'
import type { TabSwitchLens, WorkspaceStore } from '@e2e/types/globals'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assertAgentReplayNodeContract } from '@e2e/fixtures/utils/agentReplayNodeContract'

const THREAD_ID = 'e9a2f3d1-7c44-4b2e-9a01-5f6d8c7b3a10'
// One synthetic message id per turn; the recorded ids never reach the page.
const turnId = (turn: number): string =>
  `0c5b1e77-2d4a-4f9e-8b63-1a2c3d4e5${turn.toString(16).padStart(3, '0')}`
const SOCKET_SID = '7d1f2e3a-4b5c-4d6e-8f90-1a2b3c4d5e6f'
const VUE_NODES_TAG = '@vue-nodes'
const PANEL_MOUNT_TIMEOUT = 30_000
const CANCEL_TIMEOUT = 10_000

const OPEN_AGENT_LABEL = enMessages.agent.entryButton
const SEND_LABEL = enMessages.agent.send
const STOP_LABEL = enMessages.agent.stop
// The composer names itself with the rendered message, escapes resolved; the
// app's own i18n module is a Vite build, so the fixture renders the message
// with the same library over the same locale file.
const COMPOSER_LABEL = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global.t('agent.placeholder')
// Matches "Worked", "Worked for 3 seconds" and "Worked for 1m 2s" (agent.worked*).
const SUMMARY_LABEL = new RegExp(`^${enMessages.agent.worked}( for .+)?$`)
const FAILED_GLYPH = /lucide--circle-x/
const THINKING_GLYPH = '[class*="lucide--brain"]'

interface RecordedLink {
  fromNode: string
  fromSlot: number
  toNode: string
  toSlot: number
}

interface RecordedWidgetValue {
  nodeId: string
  widget: string
  value: string | number
}

interface RenderedWidgetRow {
  nodeId: string
  label: string
  value: string
  invalid: boolean
}

interface PanelCounts {
  streams: number
  summaries: number
}

// Three views of "which nodes does this tab hold" (the litegraph adapters,
// what serialize() emits, the tracker's captured state) plus the in-page
// observer's record of the rebuilt canvas and every removal since.
export interface NodeLens {
  live: string[]
  serialized: string[]
  activeState: string[]
  observer: TabSwitchLens | null
}

async function attachJson(
  testInfo: TestInfo,
  name: string,
  value: unknown
): Promise<void> {
  await testInfo.attach(name, {
    body: JSON.stringify(value, null, 2),
    contentType: 'application/json'
  })
}

// [id, from, from_slot, to, to_slot, type], as the projection stores a link.
const zProjectedLink = z
  .tuple([
    z.unknown(),
    z.union([z.string(), z.number()]),
    z.number(),
    z.union([z.string(), z.number()]),
    z.number()
  ])
  .rest(z.unknown())

// The projected node fields the canvas assertions read.
const zProjectedNode = z
  .object({
    id: z.union([z.string(), z.number()]),
    type: z.string(),
    title: z.string().optional(),
    inputs: z
      .array(z.object({ widget: z.unknown().optional() }).passthrough())
      .optional()
  })
  .passthrough()

function linkKey(link: RecordedLink): string {
  return `${link.fromNode}:${link.fromSlot}->${link.toNode}:${link.toSlot}`
}

function byLinkKey(a: RecordedLink, b: RecordedLink): number {
  return linkKey(a).localeCompare(linkKey(b))
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

async function withTimeout(
  promise: Promise<void>,
  ms: number,
  message: string
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  try {
    await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

// Runs one recorded prompt/response through the real panel over a routed /ws socket.
export class AgentConversationHarness {
  readonly panel: Locator
  readonly vueNodes: VueNodeHelpers
  readonly topbar: Topbar
  readonly composer: Locator
  readonly summaries: Locator

  private readonly host: HostDoc
  private readonly hostSocket: AgentFollowerHostSocket
  private readonly streams: Locator
  // Every node id the host has held so far, seed included.
  private readonly seenIds: Set<string>
  private readonly expectations: ExpectedTurn[]
  private postedTurns = 0
  private readonly displayNames = new Map<string, string>()
  // Resolved when the panel cancels the turn the recording stopped.
  private readonly cancelWaiters = new Map<string, () => void>()

  constructor(
    private readonly page: Page,
    readonly conversation: AgentConversation,
    readonly replayTiming: ReplayTiming,
    caseId: string,
    humanOpsHost: HumanOpsHost = 'hold'
  ) {
    const { workflow } = conversation
    this.host = new HostDoc(workflow.id, workflow.seed, workflow.catalog)
    this.hostSocket = new AgentFollowerHostSocket(
      page,
      workflow.id,
      this.host,
      SOCKET_SID,
      humanOpsHost
    )
    this.seenIds = new Set(workflow.seed.nodes.map((node) => String(node.id)))
    const expectations = RECORDED_EXPECTATIONS[caseId]
    const recorded = expectations?.length ?? 0
    if (recorded !== conversation.turns.length)
      throw new Error(
        `agentConversationExpectations.ts records ${recorded} turn(s) for ${caseId}; the recording has ${conversation.turns.length}`
      )
    this.expectations = expectations ?? []
    this.panel = page.locator('#agent-panel-root')
    this.streams = this.panel.getByTestId('markdown-stream')
    this.composer = this.panel.getByRole('textbox', { name: COMPOSER_LABEL })
    this.summaries = this.panel.getByRole('button', { name: SUMMARY_LABEL })
    this.vueNodes = new VueNodeHelpers(page)
    this.topbar = new Topbar(page)
  }

  addedNodeIds(): string[] {
    return this.conversation.turns
      .flatMap((turn) => turn.response)
      .flatMap((entry) => (entry.kind === 'graph_ops' ? entry.ops : []))
      .filter((op) => op.op === 'add_node')
      .map((op) => String(op.node_id))
  }

  async nodesOutsideVisibleCanvas(ids: readonly string[]): Promise<string[]> {
    const viewport = this.page.viewportSize()
    if (!viewport) throw new Error('this assertion needs a sized page')
    const panelBox = await this.panel.boundingBox()
    const visible = {
      right: panelBox ? Math.min(panelBox.x, viewport.width) : viewport.width,
      bottom: viewport.height
    }
    const seen = await Promise.all(
      ids.map(async (id) => {
        const box = await this.vueNodes.getNodeLocator(id).boundingBox()
        const inside =
          box !== null &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= visible.right &&
          box.y + box.height <= visible.bottom
        return { id, inside }
      })
    )
    return seen
      .filter((node) => !node.inside)
      .map((node) => node.id)
      .sort()
  }

  async boot(agentFlag: boolean, vueNodes: boolean): Promise<void> {
    await this.mockAgentApi()
    await this.hostSocket.install()
    const objectInfo = this.page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith('/api/object_info')
    )
    await bootAgentApp(this.page, agentFlag, {
      settings: {
        'Comfy.VueNodes.Enabled': vueNodes,
        'Comfy.Graph.CanvasInfo': false
      },
      // Replayed nodes materialize from registered node types; the recordings use core nodes only.
      objectInfo: agentReplayNodeDefs
    })
    const definitions = (await (await objectInfo).json()) as ObjectInfoResponse
    for (const [type, definition] of Object.entries(definitions))
      this.displayNames.set(type, definition.display_name || definition.name)
    const unregistered = Object.keys(
      this.conversation.workflow.catalog.types
    ).filter((type) => !this.displayNames.has(type))
    if (unregistered.length > 0)
      throw new Error(
        `${this.page.url()} serves no node definitions for ${unregistered.join(', ')}; the replay needs a ComfyUI backend behind the dev server (browser_tests/README.md, "Replay coverage for agent bug fixes")`
      )

    await this.page
      .getByRole('button', { name: OPEN_AGENT_LABEL, exact: true })
      .click()
    await expect(this.panel).toBeVisible({ timeout: PANEL_MOUNT_TIMEOUT })
    await this.selectWorkflowTarget()
  }

  private async selectWorkflowTarget(): Promise<void> {
    await mockWorkflowPersistence(this.page, this.conversation.workflow.id)
    const picker = this.panel.getByRole('button', {
      name: enMessages.agent.switchWorkflow
    })
    await picker.click()
    await this.page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
    await expect(picker).toHaveText('Unsaved Workflow')
  }

  async persistSavedWorkflow(): Promise<void> {
    let saved: { info: UserDataFullInfo; content: string } | undefined
    await this.page.route('**/api/userdata**', (route) => {
      const request = route.request()
      const path = decodeURIComponent(
        new URL(request.url()).pathname.split('/userdata/')[1] ?? ''
      )
      if (request.method() !== 'POST' || !path.startsWith('workflows/'))
        return route.fallback()
      saved = {
        info: {
          path,
          modified: Date.now(),
          size: request.postDataBuffer()?.length ?? 0
        },
        content: request.postData() ?? '{}'
      }
      return route.fallback()
    })
    await this.page.route('**/api/userdata**', (route) => {
      const request = route.request()
      if (request.method() !== 'GET' || !saved) return route.fallback()
      const url = new URL(request.url())
      const path = decodeURIComponent(url.pathname.split('/userdata/')[1] ?? '')
      if (path === saved.info.path)
        return route.fulfill({
          contentType: 'application/json',
          body: saved.content
        })
      if (url.searchParams.get('dir') !== 'workflows') return route.fallback()
      return route.fulfill(
        jsonRoute([
          {
            ...saved.info,
            path: saved.info.path.slice('workflows/'.length)
          }
        ])
      )
    })
  }

  async sendPrompt(turn = 0): Promise<void> {
    const { content } = this.conversation.turns[turn].request
    await this.composer.fill(content)
    await this.panel.getByRole('button', { name: SEND_LABEL }).click()
    // Replay frames are dropped until the page has applied the ack's thread id.
    // useAgentSession records the user turn straight after storing that id, so
    // the rendered turn says the ack landed without reading private storage.
    await expect(this.panel.getByText(content).first()).toBeVisible()
  }

  private async waitForRecordedOffset(
    startedAt: number,
    offset: number | undefined
  ): Promise<void> {
    if (this.replayTiming !== 'recorded' || offset === undefined) return

    let remaining = offset - (Date.now() - startedAt)
    // A timer can fire a millisecond early, so wait until the offset has really passed.
    while (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining))
      remaining = offset - (Date.now() - startedAt)
    }
  }

  async replayResponse(
    turn = 0,
    beforeFirstGraphOps?: () => Promise<void>
  ): Promise<void> {
    const startedAt = Date.now()
    const response = this.conversation.turns[turn].response
    const firstGraphOps = response.findIndex(
      (entry) => entry.kind === 'graph_ops'
    )
    for (const [index, entry] of response.entries()) {
      await this.waitForRecordedOffset(startedAt, entry.at_ms)
      if (entry.kind === 'event')
        this.hostSocket.send(this.stampTurn(entry.event, turn))
      else {
        await this.hostSocket.waitForSubscribe()
        if (index === firstGraphOps) await beforeFirstGraphOps?.()
        this.hostSocket.send(this.host.apply(entry.ops))
        for (const id of Object.keys(this.host.graph().nodes))
          this.seenIds.add(id)
      }
      // The recorded turn was stopped here, so the panel stops here too.
      if (index === this.conversation.turns[turn].cancel_after)
        await this.stopTurn(turn)
    }
  }

  // Every turn in order, each judged on the panel and the canvas as it lands.
  async runTurns(beforeFirstGraphOps?: () => Promise<void>): Promise<void> {
    for (const turn of this.conversation.turns.keys()) {
      const before = await this.panelCounts()
      await this.sendPrompt(turn)
      await this.replayResponse(turn, beforeFirstGraphOps)
      await this.waitForTurnComplete()
      await this.expectTurnRendered(turn, before)
      await this.expectCanvasReplayed(turn)
    }
  }

  private async panelCounts(): Promise<PanelCounts> {
    return {
      streams: await this.streams.count(),
      summaries: await this.summaries.count()
    }
  }

  // Everything the recording played through the given turn (all turns by default).
  private entries(throughTurn?: number): AgentConversationTurn['response'] {
    const last = throughTurn === undefined ? undefined : throughTurn + 1
    return this.conversation.turns
      .slice(0, last)
      .flatMap((turn) => turn.response)
  }

  // Clicks Stop, then holds the recorded tail until the panel's cancel for this
  // turn reaches the server: the completed conversation is reachable only
  // through that request.
  private async stopTurn(turn: number): Promise<void> {
    const accepted = new Promise<void>((resolve) =>
      this.cancelWaiters.set(turnId(turn), resolve)
    )
    await this.panel.getByRole('button', { name: STOP_LABEL }).click()
    await withTimeout(
      accepted,
      CANCEL_TIMEOUT,
      'the panel never cancelled the stopped turn'
    )
  }

  async waitForTurnComplete(): Promise<void> {
    await expect(
      this.panel.getByRole('button', { name: SEND_LABEL })
    ).toBeVisible()
    await expect(
      this.panel.getByRole('button', { name: STOP_LABEL })
    ).toHaveCount(0)
  }

  // Last write wins per widget; the rendered control shows only the final value.
  private recordedWidgetValues(throughTurn: number): RecordedWidgetValue[] {
    const graph = this.host.graph()
    const latest = new Map<string, RecordedWidgetValue>()
    for (const entry of this.entries(throughTurn)) {
      if (entry.kind !== 'graph_ops') continue
      for (const op of entry.ops) {
        if (op.op !== 'set_widget' || typeof op.widget !== 'string') continue
        const nodeId = String(op.node_id)
        const widget = op.widget
        const widgets = graph.nodes[nodeId]?.widgets as
          | Record<string, unknown>
          | undefined
        const value = widgets?.[widget]
        if (typeof value === 'string' || typeof value === 'number')
          latest.set(`${nodeId}/${widget}`, { nodeId, widget, value })
      }
    }
    return [...latest.values()]
  }

  // The renderer's link map names the endpoints no DOM surface does; the
  // painted result is a screenshot expectation in the replay spec.
  private async renderedLinks(): Promise<RecordedLink[]> {
    const links = await this.page.evaluate(() =>
      [...window.app!.graph.links.values()].map((link) => ({
        fromNode: String(link.origin_id),
        fromSlot: link.origin_slot,
        toNode: String(link.target_id),
        toSlot: link.target_slot
      }))
    )
    return links.sort(byLinkKey)
  }

  // What this turn put on the panel, against the recording's explicit
  // expectations: the complete assistant text, and the tool call rows in order
  // as a user reads them once the turn's work summary is open.
  private async expectTurnRendered(
    turn: number,
    before: PanelCounts
  ): Promise<void> {
    const expected = this.expectations[turn]
    const apiBase = new URL('/api', this.page.url()).href.replace(/\/+$/, '')
    const text = expected.text.replaceAll('{apiBase}', apiBase)
    await expect
      .poll(async () =>
        collapse(
          (await this.streams.allInnerTexts()).slice(before.streams).join(' ')
        )
      )
      .toBe(text)

    // A finished turn folds its tool calls into one closed summary; the
    // thinking rows it lists between them are not part of the recording.
    const rows = expected.groups.flat()
    await expect(this.summaries).toHaveCount(
      before.summaries + (rows.length > 0 ? 1 : 0)
    )
    if (rows.length === 0) return
    const summary = this.summaries.nth(before.summaries)
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    await summary.click()
    const items = summary
      .locator('..')
      .getByRole('listitem')
      .filter({ hasNot: this.page.locator(THINKING_GLYPH) })
    await expect(items).toHaveCount(rows.length)
    for (const [at, row] of rows.entries()) {
      const item = items.nth(at)
      await expect(item.getByText(row.label, { exact: true })).toBeVisible()
      const glyph = item.locator('span').first()
      if (row.failed) await expect(glyph).toHaveClass(FAILED_GLYPH)
      else await expect(glyph).not.toHaveClass(FAILED_GLYPH)
      if (row.count > 1) await expect(item).toContainText(`×${row.count}`)
      else await expect(item).not.toContainText('×')
    }
  }

  renderedWidgetRows(): Promise<RenderedWidgetRow[]> {
    return this.page.getByTestId(TestIds.widgets.widget).evaluateAll(
      (rows, labelTestId) =>
        rows.map((row) => {
          const control = row.querySelector('input, textarea')
          return {
            nodeId:
              row.closest('[data-node-id]')?.getAttribute('data-node-id') ?? '',
            label:
              row
                .querySelector(`[data-testid="${labelTestId}"]`)
                ?.textContent.trim() ?? '',
            value:
              control instanceof HTMLInputElement ||
              control instanceof HTMLTextAreaElement
                ? control.value
                : row.textContent.trim(),
            invalid: row.querySelector('[aria-invalid="true"]') !== null
          }
        }),
      TestIds.widgets.layoutFieldLabel
    )
  }

  // What the canvas shows after the given turn, judged the way a user would
  // (which nodes, under which titles, with which widget values, wired on
  // both slot rows) against the workflow the production library projects.
  async expectCanvasReplayed(throughTurn: number): Promise<void> {
    const projected = this.host.projection()
    const nodes = projected.nodes.map((node) => zProjectedNode.parse(node))
    const present = new Set(nodes.map((node) => String(node.id)))
    for (const id of this.seenIds)
      if (!present.has(id))
        await expect(this.vueNodes.getNodeLocator(id)).toHaveCount(0)
    for (const node of nodes) {
      const id = String(node.id)
      const locator = this.vueNodes.getNodeLocator(id)
      await expect(locator).toBeVisible()
      const materialized = await this.page.evaluate((nodeId) => {
        const liveNode = window.app?.graph.getNodeById(nodeId)
        return liveNode
          ? { type: liveNode.type, hasErrors: liveNode.has_errors === true }
          : null
      }, toNodeId(id))
      const expectedTitle = assertAgentReplayNodeContract(
        node,
        this.displayNames.get(node.type),
        materialized
      )
      await expect(locator.getByTestId('node-title')).toHaveText(expectedTitle)
    }
    await expect(this.page.getByTestId('node-title')).toHaveCount(nodes.length)

    for (const { nodeId, widget, value } of this.recordedWidgetValues(
      throughTurn
    )) {
      const field = this.vueNodes
        .getNodeLocator(nodeId)
        .getByLabel(widget, { exact: true })
      if (typeof value === 'number') {
        // Number widgets format their input (0.5 renders as 0.50), so compare the number.
        await expect
          .poll(async () =>
            Number(await field.locator('input').first().inputValue())
          )
          .toBe(value)
        continue
      }
      const tag = await field.evaluate((el) => el.tagName.toLowerCase())
      if (tag === 'button') await expect(field).toContainText(value)
      else await expect(field).toHaveValue(value)
    }

    const links = projected.links
      .map((raw): RecordedLink => {
        const [, fromNode, fromSlot, toNode, toSlot] = zProjectedLink.parse(raw)
        return {
          fromNode: String(fromNode),
          fromSlot,
          toNode: String(toNode),
          toSlot
        }
      })
      .sort(byLinkKey)
    await expect.poll(() => this.renderedLinks()).toEqual(links)
    // A widget-backed input renders no slot row on an uncollapsed node
    // (NodeSlots.vue); the wire above already covers that end.
    for (const link of links) {
      await expect(
        this.vueNodes.getOutputSlotRow(link.fromNode, link.fromSlot)
      ).toHaveClass(/lg-slot--connected/)
      const target = nodes.find((node) => String(node.id) === link.toNode)
      if (target?.inputs?.[link.toSlot]?.widget == null)
        await expect(
          this.vueNodes.getInputSlotRow(link.toNode, link.toSlot)
        ).toHaveClass(/lg-slot--connected/)
    }
  }

  private async mockAgentApi(): Promise<void> {
    const { page } = this
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute({ threads: [] }))
    )
    await page.route('**/api/agent/threads/*/messages', (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        this.postedTurns += 1
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            thread_id: THREAD_ID,
            message_id: turnId(this.postedTurns - 1),
            workflow_id: this.conversation.workflow.id
          })
        })
      }
      const history: AgentMessages = []
      return route.fulfill(jsonRoute(history))
    })
    await page.route('**/api/agent/threads/*/messages/*/cancel', (route) => {
      const target = /\/threads\/([^/]+)\/messages\/([^/]+)\/cancel/.exec(
        route.request().url()
      )
      const release =
        target === null || target[1] !== THREAD_ID
          ? undefined
          : this.cancelWaiters.get(target[2])
      // A real server knows nothing about any other message.
      if (release === undefined) return route.fulfill({ status: 404 })
      release()
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

  private stampTurn(event: RecordedWsEvent, turn: number): AgentWsEvent {
    const stamped = {
      type: event.type,
      data: { ...event.data, message_id: turnId(turn), thread_id: THREAD_ID }
    }
    const parsed = parseAgentWsEvent(stamped)
    if (!parsed.success)
      throw new Error(
        `recorded ${event.type} frame is not a valid agent event: ${parsed.error.message}`
      )
    return parsed.data
  }

  /** Every `doc_*` frame the page has sent so far, oldest first. */
  clientDocFrames(): ClientDocFrame[] {
    return this.hostSocket.clientDocFrames()
  }

  /** The applier's verdict on every human op the host has judged so far. */
  humanOpOutcomes(): ApplyOutcome[] {
    return this.hostSocket.humanOpOutcomes()
  }

  /** Node ids the host document holds right now. */
  hostNodeIds(): string[] {
    return Object.keys(this.host.graph().nodes)
  }

  // A host-side edit outside the recording, pushed as one `doc_update`. The
  // follower applies frames in order, so a rendered effect of this edit
  // proves every earlier frame (a catch-up included) has been applied too.
  pushHostOps(operations: RecordedGraphOperation[]): void {
    this.hostSocket.send(this.host.apply(operations))
    for (const id of Object.keys(this.host.graph().nodes)) this.seenIds.add(id)
  }

  // Rises once per follower subscribe; a tab return re-subscribes and the
  // host answers with the catch-up frame this counter has just sent.
  subscribeCount(): number {
    return this.hostSocket.subscribeCount()
  }

  async disconnectAndApplyRecordedTurn(turn: number): Promise<void> {
    await this.hostSocket.disconnect()
    for (const entry of this.conversation.turns[turn].response) {
      if (entry.kind === 'graph_ops') this.host.apply(entry.ops)
    }
    for (const id of Object.keys(this.host.graph().nodes)) this.seenIds.add(id)
  }

  private graphNodeIds(): Promise<string[]> {
    return this.page.evaluate(() =>
      window.app!.graph.nodes.map((node) => String(node.id))
    )
  }

  // The ordinary add path: the same createNode + graph.add every node type
  // takes, whether the search box, the sidebar or a paste drives it.
  addNodeOfType(type: string, position: [number, number]): Promise<string> {
    return this.page.evaluate(
      ([nodeType, pos]) => {
        const node = window.LiteGraph!.createNode(nodeType)
        if (!node) throw new Error(`${nodeType} is not a registered node type`)
        node.pos = [pos[0], pos[1]]
        window.app!.graph.add(node)
        return String(node.id)
      },
      [type, position] as const
    )
  }

  // The blueprint add path (`addNodeOnGraph` for a `SubgraphBlueprint.*` def):
  // the blueprint's nodes and definitions pasted through `_deserializeItems`.
  addBlueprint(
    promoteText: boolean,
    position: [number, number]
  ): Promise<string> {
    return this.page.evaluate(
      ([bp, pos]) => {
        const items: object = {
          nodes: bp.nodes,
          subgraphs: bp.definitions?.subgraphs
        }
        const results = window.app!.canvas._deserializeItems(items, {
          position: [pos[0], pos[1]]
        })
        const node = results?.nodes.values().next().value
        if (!node) throw new Error('the blueprint paste produced no node')
        return String(node.id)
      },
      [agentHumanAddBlueprint(promoteText), position] as const
    )
  }

  // A frontend-only node added the way a person actually adds one: the node
  // search box, double-clicked open, typed into, Enter — not a direct
  // LiteGraph.createNode call. The non-Agent baseline
  // (workflowTabSwitchKeepsAddedNodes.spec.ts) covers this path too.
  async addNoteThroughSearchBox(position: {
    x: number
    y: number
  }): Promise<string> {
    const before = new Set(await this.graphNodeIds())
    await this.page.mouse.dblclick(position.x, position.y, { delay: 5 })
    const dialog = this.page.getByRole('search')
    // Scoped by accessible name: the seed workflow already has nodes on the
    // canvas, and a widget-select trigger (e.g. LoadImage's) is also
    // role="combobox", so an unnamed query resolves to more than one match.
    const input = dialog.getByRole('combobox', { name: enMessages.g.addNode })
    await input.waitFor({ state: 'visible' })
    await input.fill('Note')
    const results = dialog.getByTestId(TestIds.searchBoxV2.resultItem)
    await expect(results.first()).toContainText('Note')
    await this.page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await this.page.mouse.click(position.x, position.y)
    const after = await this.graphNodeIds()
    const [added] = after.filter((id) => !before.has(id))
    if (!added) throw new Error('the search box add produced no node')
    return added
  }

  // Records the live node set the moment a tab's canvas finishes rebuilding,
  // and every node the live graph drops afterwards, so a node present after
  // configure() and gone later is distinguishable from one never rebuilt.
  installTabSwitchObserver(): Promise<void> {
    return this.page.evaluate(() => {
      const lens: TabSwitchLens = { afterConfigure: [], removed: [] }
      window.__tabSwitchLens = lens
      const app = window.app!
      app.registerExtension({
        name: 'TabSwitchLens',
        afterConfigureGraph() {
          lens.afterConfigure.push(
            app.graph.nodes.map((node) => String(node.id))
          )
        }
      })
      app.rootGraph.events.addEventListener('node:removed', (event) => {
        lens.removed.push(String(event.detail.node.id))
      })
    })
  }

  readNodeLens(): Promise<NodeLens> {
    return this.page.evaluate(() => {
      const app = window.app!
      const store = app.extensionManager as WorkspaceStore
      return {
        live: app.graph.nodes.map((node) => String(node.id)),
        serialized: app.graph.serialize().nodes.map((node) => String(node.id)),
        activeState:
          store.workflow.activeWorkflow?.changeTracker.activeState.nodes.map(
            (node) => String(node.id)
          ) ?? [],
        observer: window.__tabSwitchLens ?? null
      }
    })
  }

  // A snapshot of every lens this suite judges a tab switch by, attached to
  // the test report under `phase` so a failure's evidence is easy to find.
  async attachEvidence(testInfo: TestInfo, phase: string): Promise<NodeLens> {
    const lens = await this.readNodeLens()
    await attachJson(testInfo, `${phase}-node-lens`, lens)
    await attachJson(testInfo, `${phase}-host-node-ids`, this.hostNodeIds())
    await attachJson(
      testInfo,
      `${phase}-client-doc-frames`,
      this.clientDocFrames()
    )
    await attachJson(
      testInfo,
      `${phase}-human-op-outcomes`,
      this.humanOpOutcomes()
    )
    await testInfo.attach(`${phase}.png`, {
      body: await this.page.screenshot(),
      contentType: 'image/png'
    })
    return lens
  }

  // The page has minted `count` human batches and the host has judged each.
  async waitForHumanOps(count: number): Promise<ApplyOutcome[]> {
    await expect
      .poll(() => this.humanOpOutcomes().length)
      .toBeGreaterThanOrEqual(count)
    return this.humanOpOutcomes()
  }

  // A host edit pushed after everything under test; once it renders, every
  // frame queued ahead of it (a tab-return catch-up, an op echo) has applied.
  async waitForPendingFrames(
    nodeId: string,
    widget: string,
    marker: string
  ): Promise<void> {
    this.pushHostOps([
      { op: 'set_widget', node_id: Number(nodeId), widget, value: marker }
    ])
    await expect(
      this.vueNodes.getNodeLocator(nodeId).getByLabel(widget, { exact: true })
    ).toHaveValue(marker)
  }

  async switchAwayAndBack(nodeId: string, widget: string): Promise<void> {
    const tabs = this.topbar.workflowTabs.locator('.p-togglebutton')
    await expect(tabs).toHaveCount(1)
    await this.topbar.newWorkflowButton.click()
    await expect(tabs).toHaveCount(2)
    await expect(this.vueNodes.nodes).toHaveCount(0)

    const subscribes = this.subscribeCount()
    await this.topbar.getTab(0).click()
    await expect(this.topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
    await expect.poll(() => this.subscribeCount()).toBe(subscribes + 1)
    await this.waitForPendingFrames(
      nodeId,
      widget,
      'tab return catch-up landed'
    )
  }

  hostNodePositions(): (number[] | undefined)[] {
    return this.host.projection().nodes.map((node) => node.pos)
  }

  async reloadWithoutLocalWorkflow(): Promise<void> {
    await this.page.evaluate(() => {
      for (const storage of [localStorage, sessionStorage]) {
        const workflowKeys = Object.keys(storage).filter((key) =>
          key.startsWith('Comfy.Workflow.')
        )
        for (const key of workflowKeys) storage.removeItem(key)
      }
    })
    await this.page.reload({ waitUntil: 'domcontentloaded' })
    await this.page.waitForFunction(() => window.app?.extensionManager)
    await this.page.getByTestId(TestIds.app.loadingOverlay).waitFor({
      state: 'hidden',
      timeout: PANEL_MOUNT_TIMEOUT
    })
    await expect(this.panel).toBeVisible({ timeout: PANEL_MOUNT_TIMEOUT })
    await this.selectWorkflowTarget()
  }
}

export type ReplayTiming = 'immediate' | 'recorded'

function defaultReplayTiming(): ReplayTiming {
  const value = process.env.AGENT_REPLAY_TIMING
  if (value === undefined || value === 'immediate') return 'immediate'
  if (value === 'recorded') return 'recorded'
  throw new Error(
    `AGENT_REPLAY_TIMING must be immediate or recorded, got ${value}`
  )
}

interface ConversationFixtures {
  conversationCase: string
  // 'recorded' replays the fixture's at_ms gaps; the default follows AGENT_REPLAY_TIMING.
  replayTiming: ReplayTiming
  humanOpsHost: HumanOpsHost
  agentConversation: AgentConversationHarness
}

// Wide enough to keep the whole seed graph beside the docked panel; the video follows the viewport instead of Playwright's 800px cap.
const VIEWPORT = { width: 2560, height: 1440 }

export const agentConversationTest = agentTest.extend<ConversationFixtures>({
  conversationCase: ['', { option: true }],
  replayTiming: [defaultReplayTiming(), { option: true }],
  humanOpsHost: ['hold', { option: true }],
  viewport: VIEWPORT,
  video: {
    mode:
      process.env.PLAYWRIGHT_LOCAL || process.env.RECORD_VIDEO === 'true'
        ? 'on'
        : 'off',
    size: VIEWPORT
  },
  agentConversation: async (
    { page, agentFlagEnabled, conversationCase, replayTiming, humanOpsHost },
    use,
    testInfo
  ) => {
    if (conversationCase.length === 0)
      throw new Error('test.use({ conversationCase }) names the conversation')
    const vueNodes = testInfo.tags.includes(VUE_NODES_TAG)
    if (!vueNodes)
      throw new Error(
        `a conversation replay is judged on Vue nodes; tag the test ${VUE_NODES_TAG}`
      )
    const harness = new AgentConversationHarness(
      page,
      loadAgentConversation(conversationCase),
      replayTiming,
      conversationCase,
      humanOpsHost
    )
    await harness.boot(agentFlagEnabled, vueNodes)
    await use(harness)
  }
})
