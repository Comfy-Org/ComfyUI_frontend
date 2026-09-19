import { expect } from '@playwright/test'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { LocalWriteLegHarness } from '@e2e/fixtures/agentLocalWriteLegFixture'
import {
  clickNodeTitle,
  currentGraphNodeIds,
  enterSubgraphNode,
  isInsideSubgraph
} from '@e2e/fixtures/utils/rawCanvasNodeOps'
import { assetPath } from '@e2e/fixtures/utils/paths'

/**
 * Repro coverage for Sentry CLOUD-FRONTEND-STAGING-4KM
 * (https://comfy-org.sentry.io/issues/7727249665/): a local human structural
 * edit to a node interior to a subgraph never reaches the bound CRDT doc.
 *
 * `reportUnrepresentableInteriorChange` in `layoutMintPort.ts` (added by
 * #16611) is a deliberate guard: when a node's `ownerGraphId` differs from
 * the root `graphId` a `createNode`/`deleteNode` operation carries, it
 * reports the divergence and returns WITHOUT enqueuing a wire op, because the
 * wire protocol's `Op` union has no subgraph-scoping field for
 * `add_node`/`delete_node` yet. The local graph store already applied the
 * edit, so the bound doc silently falls behind it. That RCA is not in
 * question here.
 *
 * These two tests are `test.fixme()`, NOT yet real repros: the assertion
 * bodies below express the desired end state (a matching wire op reaches the
 * bound doc), but `LocalWriteLegHarness.openPanelAndBindWorkflow()` cannot
 * yet get `isDocBound()` true outside the real app flow. The agent's own
 * `agent_active_tab` WS event is sent and parses fine, but the CRDT
 * follower never issues a `doc_subscribe` for it (confirmed: the only
 * client-sent `/ws` frame captured is `feature_flags`), so
 * `isBoundWorkflowActive` in `AgentPanelRoot.vue` never flips true and the
 * mint-port gate this bug lives behind is never reached. Two things worth
 * trying next:
 *   1. Read `useAgentWorkflowSelection`'s `status`/`canSelectTarget` state
 *      directly off the Pinia store via `page.evaluate` to see what's
 *      actually blocking `isBoundWorkflowActive` after the `agent_active_tab`
 *      event lands (the earlier symptom, before this event-injection
 *      approach, was the "Switch workflow" picker's `menuitemradio` click
 *      never taking effect — `aria-checked` stayed `false` under `.click()`,
 *      `.click({force:true})`, and `.press('Enter')`).
 *   2. Trace `workflow?.activeTab?.(event.data)` in `useAgentSession.ts`
 *      (~line 496) and `bindingStore.bind()` in `AgentPanelRoot.vue`
 *      (~line 440, `onWorkflowActiveTab`) to find the exact condition that
 *      keeps the freshly-loaded tab from being "adoptable".
 *
 * Once `isDocBound()` is reachable, flip `test.fixme()` back to `test.fail()`
 * (or a real assertion once the wire-protocol fix ships) — do not relax the
 * assertions themselves, they already express the correct desired behavior.
 */

const WORKFLOW_ID = '8f2b6c39-1a4d-4e9a-8b7f-6c5d4e3f2a10'
const THREAD_ID = 'a1b2c3d4-e5f6-4789-9abc-def012345678'
const MESSAGE_ID = 'f0e1d2c3-b4a5-4678-9abc-def012345601'
const REPORTED_ERROR_PREFIX = '[Reported error]: '
// Root graph node id of the single subgraph instance in the test asset.
const SUBGRAPH_NODE_ID = '2'

async function bootWithInteriorSubgraphWorkflow(
  page: Parameters<typeof bootAgentApp>[0]
): Promise<LocalWriteLegHarness> {
  const harness = new LocalWriteLegHarness(
    page,
    WORKFLOW_ID,
    THREAD_ID,
    MESSAGE_ID,
    'Unsaved Workflow'
  )
  await harness.bindDoc()
  await bootAgentApp(page, true)
  // Bind the agent to the default blank tab first (the same target
  // `agentConversationFixture` uses), then load the asset into that SAME
  // still-active tab — loading it beforehand would open a second
  // "basic-subgraph" tab instead of replacing the blank one, leaving the
  // agent bound to a tab the canvas below never shows.
  await harness.openPanelAndBindWorkflow()
  // basic-subgraph.json: root node 2 wraps a subgraph containing KSampler
  // (id 1) and VAEEncode (id 2) as interior nodes. Node types resolve to
  // "missing node" placeholders under this spec's empty object_info mock —
  // irrelevant here, since the bug is about structural mint, not execution.
  await page
    .locator('#comfy-file-input')
    .setInputFiles(assetPath('subgraphs/basic-subgraph.json'))
  await enterSubgraphNode(page, SUBGRAPH_NODE_ID)
  await expect.poll(() => isInsideSubgraph(page)).toBe(true)
  return harness
}

test.describe(
  'Agent CRDT: subgraph-interior structural edits have no wire op',
  { tag: ['@cloud', '@agent', '@subgraph'] },
  () => {
    test('interior node DELETE never reaches the bound doc', async ({
      page
    }, testInfo) => {
      test.fixme(
        true,
        'harness cannot bind the agent panel to a workflow outside the real app flow yet — see the file header'
      )

      const reportedErrors: string[] = []
      page.on('console', (message) => {
        if (message.text().startsWith(REPORTED_ERROR_PREFIX))
          reportedErrors.push(message.text())
      })

      const harness = await bootWithInteriorSubgraphWorkflow(page)
      const before = await currentGraphNodeIds(page)
      expect(before).toContain('1')

      await clickNodeTitle(page, '1')
      await page.keyboard.press('Delete')

      await expect.poll(() => currentGraphNodeIds(page)).not.toContain('1')

      await testInfo.attach('canvas-after-local-delete', {
        body: await page.screenshot(),
        contentType: 'image/png'
      })

      expect(
        reportedErrors.some((line) =>
          line.includes('agent_crdt_unrepresentable_subgraph_node_delete')
        ),
        'the guard should have reported the divergence — if not, this is a fixture/setup bug, not the CRDT bug'
      ).toBe(true)

      const deleteOps = harness
        .docOpsSent()
        .filter((op) => op.op === 'delete_node' && String(op.node_id) === '1')
      // DESIRED behavior: the interior delete reaches the bound doc as a
      // wire op. Today the guard drops it, so this fails — the bound doc
      // (and any second/follower view of it) still shows node 1 after a
      // view that already lost it locally.
      expect(
        deleteOps,
        'no delete_node wire op reached the bound doc for the interior node — the local graph and the bound doc have diverged'
      ).not.toHaveLength(0)
    })

    test('interior node CREATE never reaches the bound doc', async ({
      page
    }, testInfo) => {
      test.fixme(
        true,
        'harness cannot bind the agent panel to a workflow outside the real app flow yet — see the file header'
      )

      const reportedErrors: string[] = []
      page.on('console', (message) => {
        if (message.text().startsWith(REPORTED_ERROR_PREFIX))
          reportedErrors.push(message.text())
      })

      const harness = await bootWithInteriorSubgraphWorkflow(page)
      const before = await currentGraphNodeIds(page)

      // Duplicate the remaining interior node (VAEEncode, id 2) via the
      // real copy/paste shortcut — a genuine local human createNode, same
      // as dragging a new node from the library, but far simpler to drive
      // headlessly. ownerGraphId is set to the subgraph either way.
      await clickNodeTitle(page, '2')
      await page.locator('#graph-canvas').press('Control+KeyC')
      await page.locator('#graph-canvas').press('Control+KeyV')

      await expect
        .poll(async () => (await currentGraphNodeIds(page)).length)
        .toBeGreaterThan(before.length)
      const after = await currentGraphNodeIds(page)
      const newNodeIds = after.filter((id) => !before.includes(id))
      expect(newNodeIds.length).toBeGreaterThan(0)

      await testInfo.attach('canvas-after-local-create', {
        body: await page.screenshot(),
        contentType: 'image/png'
      })

      expect(
        reportedErrors.some((line) =>
          line.includes('agent_crdt_unrepresentable_subgraph_node_create')
        ),
        'the guard should have reported the divergence — if not, this is a fixture/setup bug, not the CRDT bug'
      ).toBe(true)

      const addOps = harness
        .docOpsSent()
        .filter(
          (op) =>
            op.op === 'add_node' && newNodeIds.includes(String(op.node_id))
        )
      // DESIRED behavior: the interior create reaches the bound doc as a
      // wire op. Today the guard drops it, so this fails — the new node
      // exists locally but the bound doc (and any follower view) never
      // learns about it.
      expect(
        addOps,
        'no add_node wire op reached the bound doc for the new interior node — the local graph and the bound doc have diverged'
      ).not.toHaveLength(0)
    })
  }
)
