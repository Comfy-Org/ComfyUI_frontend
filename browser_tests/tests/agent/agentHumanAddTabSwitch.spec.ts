import { expect } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

import type { ApplyOutcome } from '@comfyorg/comfy-multi-player'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { AgentConversationHarness } from '@e2e/fixtures/agentConversationFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import type { TabSwitchLens, WorkspaceStore } from '@e2e/types/globals'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

// A text-only turn: the follower subscribes to the recorded workflow's doc
// and the agent changes nothing, so every node on the canvas afterwards is
// the seed or what the user adds by hand. Its pinned catalog names
// CLIPTextEncode and KSampler, and no frontend-only class.
const CASE = 'agent-rec-text-only-answer'
// The seed's "Positive prompt" CLIPTextEncode; a host edit to its text is the
// readiness boundary for "the frames pending on the follower have landed".
const PROMPT_NODE_ID = '6'
const ADD_POSITION: [number, number] = [400, 400]

interface NodeLens {
  live: string[]
  serialized: string[]
  activeState: string[]
  observer: TabSwitchLens | null
}

// Three views of "which nodes does this tab hold" (the litegraph adapters,
// what serialize() emits, the tracker's captured state) plus the in-page
// observer's record of the rebuilt canvas and every removal since.
function readNodeLens(page: Page): Promise<NodeLens> {
  return page.evaluate(() => {
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

// Records the live node set the moment a tab's canvas finishes rebuilding,
// and every node the live graph drops afterwards, so a node present after
// configure() and gone later is distinguishable from one never rebuilt.
function installTabSwitchObserver(page: Page): Promise<void> {
  return page.evaluate(() => {
    const lens: TabSwitchLens = { afterConfigure: [], removed: [] }
    window.__tabSwitchLens = lens
    const app = window.app!
    app.registerExtension({
      name: 'TabSwitchLens',
      afterConfigureGraph() {
        lens.afterConfigure.push(app.graph.nodes.map((node) => String(node.id)))
      }
    })
    app.rootGraph.events.addEventListener('node:removed', (event) => {
      lens.removed.push(String(event.detail.node.id))
    })
  })
}

// The ordinary add path: the same createNode + graph.add every node type
// takes, whether the search box, the sidebar or a paste drives it.
function addNodeOfType(page: Page, type: string): Promise<string> {
  return page.evaluate(
    ([nodeType, pos]) => {
      const node = window.LiteGraph!.createNode(nodeType)
      if (!node) throw new Error(`${nodeType} is not a registered node type`)
      node.pos = [pos[0], pos[1]]
      window.app!.graph.add(node)
      return String(node.id)
    },
    [type, ADD_POSITION] as const
  )
}

// A blueprint as `useSubgraphStore().getBlueprint()` hands it to
// `addNodeOnGraph`: one host node typed by a fresh definition wrapping a
// CLIPTextEncode. `promoteText` exposes the interior text widget on the host.
function blueprint(promoteText: boolean): ComfyWorkflowJSON {
  const definitionId = '4d3f5a6e-0b1c-4d2e-9f80-1a2b3c4d5e6f'
  return {
    last_node_id: 2,
    last_link_id: 0,
    nodes: [
      {
        id: 2,
        type: definitionId,
        title: 'prompt blueprint',
        pos: [0, 0],
        size: [300, 120],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: null }],
        properties: { proxyWidgets: promoteText ? [['1', 'text']] : [] },
        widgets_values: promoteText ? ['a pasted prompt'] : []
      }
    ],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4,
    definitions: {
      subgraphs: [
        {
          id: definitionId,
          version: 1,
          revision: 0,
          state: {
            lastGroupId: 0,
            lastNodeId: 1,
            lastLinkId: 1,
            lastRerouteId: 0
          },
          config: {},
          name: 'prompt blueprint',
          inputNode: { id: -10, bounding: [0, 0, 120, 60] },
          outputNode: { id: -20, bounding: [700, 0, 120, 60] },
          inputs: [],
          outputs: [
            {
              id: '9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
              name: 'CONDITIONING',
              type: 'CONDITIONING',
              linkIds: [1],
              pos: [724, 24]
            }
          ],
          widgets: [],
          nodes: [
            {
              id: 1,
              type: 'CLIPTextEncode',
              pos: [200, 0],
              size: [400, 200],
              flags: {},
              order: 0,
              mode: 0,
              inputs: [
                { name: 'clip', type: 'CLIP', link: null },
                {
                  name: 'text',
                  type: 'STRING',
                  widget: { name: 'text' },
                  link: null
                }
              ],
              outputs: [
                { name: 'CONDITIONING', type: 'CONDITIONING', links: [1] }
              ],
              properties: {},
              widgets_values: ['a pasted prompt']
            }
          ],
          groups: [],
          links: [
            {
              id: 1,
              origin_id: 1,
              origin_slot: 0,
              target_id: -20,
              target_slot: 0,
              type: 'CONDITIONING'
            }
          ],
          extra: {}
        }
      ]
    }
  }
}

// The blueprint add path (`addNodeOnGraph` for a `SubgraphBlueprint.*` def):
// the blueprint's nodes and definitions pasted through `_deserializeItems`.
function addBlueprint(page: Page, promoteText: boolean): Promise<string> {
  return page.evaluate(
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
    [blueprint(promoteText), ADD_POSITION] as const
  )
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

// The applier's verdicts, one per human op the host has judged so far.
function outcomesFor(
  agentConversation: AgentConversationHarness
): ApplyOutcome[] {
  return agentConversation.humanOpOutcomes()
}

// The page has minted `count` human batches and the host has judged each.
async function waitForHumanOps(
  agentConversation: AgentConversationHarness,
  count: number
): Promise<ApplyOutcome[]> {
  await expect
    .poll(() => outcomesFor(agentConversation).length)
    .toBeGreaterThanOrEqual(count)
  return outcomesFor(agentConversation)
}

// A host edit pushed after everything under test; once it renders, every
// frame queued ahead of it (a tab-return catch-up, an op echo) has applied.
async function waitForPendingFrames(
  agentConversation: AgentConversationHarness,
  marker: string
): Promise<void> {
  agentConversation.pushHostOps([
    { op: 'set_widget', node_id: 6, widget: 'text', value: marker }
  ])
  await expect(
    agentConversation.vueNodes
      .getNodeLocator(PROMPT_NODE_ID)
      .getByLabel('text', { exact: true })
  ).toHaveValue(marker)
}

async function switchAwayAndBack(
  page: Page,
  agentConversation: AgentConversationHarness
): Promise<void> {
  const topbar = new Topbar(page)
  const tabs = topbar.workflowTabs.locator('.p-togglebutton')
  await expect(tabs).toHaveCount(1)
  await topbar.newWorkflowButton.click()
  await expect(tabs).toHaveCount(2)
  await expect(agentConversation.vueNodes.nodes).toHaveCount(0)

  const subscribes = agentConversation.subscribeCount()
  await topbar.getTab(0).click()
  await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
  await expect
    .poll(() => agentConversation.subscribeCount())
    .toBe(subscribes + 1)
  await waitForPendingFrames(agentConversation, 'tab return catch-up landed')
}

async function attachEvidence(
  testInfo: TestInfo,
  page: Page,
  agentConversation: AgentConversationHarness,
  phase: string
): Promise<NodeLens> {
  const lens = await readNodeLens(page)
  await attachJson(testInfo, `${phase}-node-lens`, lens)
  await attachJson(
    testInfo,
    `${phase}-host-node-ids`,
    agentConversation.hostNodeIds()
  )
  await attachJson(
    testInfo,
    `${phase}-client-doc-frames`,
    agentConversation.clientDocFrames()
  )
  await attachJson(
    testInfo,
    `${phase}-human-op-outcomes`,
    outcomesFor(agentConversation)
  )
  await testInfo.attach(`${phase}.png`, {
    body: await page.screenshot(),
    contentType: 'image/png'
  })
  return lens
}

interface AddCase {
  name: string
  add: (page: Page) => Promise<string>
}

// KSampler is in the pinned catalog. Note is registered by a frontend
// extension and absent from every catalog, the footing a Get/Set node from a
// custom-node pack stands on. A blueprint host is typed by a definition the
// doc has never seen; it only carries widget values when it promotes one. The
// mint keeps `widgets_values` positional for the uncatalogued classes, the
// form the applier stores opaquely instead of rejecting.
const CATALOGUED: AddCase = {
  name: 'a node from the pinned catalog',
  add: (page) => addNodeOfType(page, 'KSampler')
}
const FRONTEND_ONLY: AddCase = {
  name: 'a frontend-only node (the footing Get/Set nodes stand on)',
  add: (page) => addNodeOfType(page, 'Note')
}
const BLUEPRINT_PROMOTED: AddCase = {
  name: 'a subgraph blueprint with a promoted widget',
  add: (page) => addBlueprint(page, true)
}
const BLUEPRINT_PLAIN: AddCase = {
  name: 'a subgraph blueprint without promoted widgets',
  add: (page) => addBlueprint(page, false)
}

function expectApplied(outcomes: ApplyOutcome[], count: number): void {
  expect(outcomes.map((outcome) => outcome.outcome)).toEqual(
    Array<string>(count).fill('applied')
  )
}

test.describe(
  'Human-added node across a workflow tab switch with Agent bound',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({ conversationCase: CASE })

    // First half of the mechanism, on its own: the host takes the page's
    // add_node op and the page keeps the node.
    for (const { name, add } of [
      CATALOGUED,
      FRONTEND_ONLY,
      BLUEPRINT_PROMOTED,
      BLUEPRINT_PLAIN
    ]) {
      test(`host applies the add of ${name}, and the canvas keeps the node`, async ({
        agentConversation,
        page
      }, testInfo) => {
        test.setTimeout(90_000)
        await agentConversation.runTurns()

        const nodeId = await add(page)
        const node = agentConversation.vueNodes.getNodeLocator(nodeId)
        await expect(node).toBeVisible()
        const outcomes = await waitForHumanOps(agentConversation, 1)
        await attachEvidence(testInfo, page, agentConversation, 'after-add')

        expectApplied(outcomes, 1)
        expect(agentConversation.hostNodeIds()).toContain(nodeId)
        expect(
          agentConversation
            .clientDocFrames()
            .filter((f) => f.type === 'doc_ops')
        ).toHaveLength(1)
        await expect(node).toBeVisible()
      })
    }

    // Both halves: the add, then the tab return whose first frame reconciles
    // the stores against the doc. A node the doc holds survives it.
    for (const { name, add } of [
      CATALOGUED,
      BLUEPRINT_PLAIN,
      FRONTEND_ONLY,
      BLUEPRINT_PROMOTED
    ]) {
      test(`keeps ${name} after switching to another tab and back`, async ({
        agentConversation,
        page
      }, testInfo) => {
        test.setTimeout(90_000)
        await agentConversation.runTurns()
        await installTabSwitchObserver(page)

        const nodeId = await add(page)
        const node = agentConversation.vueNodes.getNodeLocator(nodeId)
        await expect(node).toBeVisible()
        await waitForHumanOps(agentConversation, 1)
        const before = await attachEvidence(
          testInfo,
          page,
          agentConversation,
          'before-switch'
        )
        expect(before.live).toContain(nodeId)
        expect(before.serialized).toContain(nodeId)

        await switchAwayAndBack(page, agentConversation)

        const after = await attachEvidence(
          testInfo,
          page,
          agentConversation,
          'after-return'
        )
        expect(after.activeState).toContain(nodeId)
        expect(after.observer?.afterConfigure.at(-1)).toContain(nodeId)
        await expect(node).toBeVisible()
        expect(after.observer?.removed).not.toContain(nodeId)
        expect(after.live).toContain(nodeId)
        expect(after.serialized).toContain(nodeId)
      })
    }

    // The same reconcile without any tab switch: the echo of an accepted add
    // is rejected locally ("already registered") and arms a full reconcile,
    // which the next frame runs against a doc that now holds the Note too.
    test('keeps a frontend-only node when two catalogued nodes are added after it', async ({
      agentConversation,
      page
    }, testInfo) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()
      await installTabSwitchObserver(page)

      const noteId = await addNodeOfType(page, 'Note')
      const note = agentConversation.vueNodes.getNodeLocator(noteId)
      await expect(note).toBeVisible()
      await waitForHumanOps(agentConversation, 1)

      const samplerId = await addNodeOfType(page, 'KSampler')
      await waitForHumanOps(agentConversation, 2)
      const encoderId = await addNodeOfType(page, 'CLIPTextEncode')
      const outcomes = await waitForHumanOps(agentConversation, 3)
      await waitForPendingFrames(agentConversation, 'op echoes landed')

      const lens = await attachEvidence(
        testInfo,
        page,
        agentConversation,
        'after-adds'
      )
      expectApplied(outcomes, 3)
      expect(agentConversation.hostNodeIds()).toEqual(
        expect.arrayContaining([noteId, samplerId, encoderId])
      )
      await expect(note).toBeVisible()
      expect(lens.observer?.removed).not.toContain(noteId)
      expect(lens.live).toEqual(
        expect.arrayContaining([noteId, samplerId, encoderId])
      )
    })
  }
)
