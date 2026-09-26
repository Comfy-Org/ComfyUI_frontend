import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const PLACEMENT = { x: 400, y: 400 }

/**
 * Matrix rank 30 / slack-13 + regr-12 + linear-4 + regr-38 — "a node the agent
 * touched becomes a transparent ghost I cannot select". The tab-switch route is
 * on `main` (`agentPlacedNodeGhostFlag.spec.ts`). `qspec-2` returned the other
 * two routes for budget with no blocker named and they then fell out of every
 * hand-off list; `cover-1` re-opened them
 * (`reports/design/2026-09-26-matrix-coverage-audit.md`).
 *
 * `flags.ghost` marks a node still following the cursor during a search-box
 * placement. `LGraph.add` sets it before the layout change the follower mints
 * its `add_node` from, and the placement click that clears it locally mints
 * nothing — so the flag has two ways to reach a node the user has already put
 * down, and this file guards one each:
 *
 *   1. OUTBOUND — the op this client mints must not carry the flag, and a node
 *      rebuilt from the document after a browser reload must come back solid.
 *   2. INBOUND — a document that does carry it (one written before the strip
 *      existed, or by any other writer) must still not produce an untouchable
 *      node here. This is the black-box twin of the unit guard in
 *      `src/workbench/extensions/agent/crdt/ghostPlacementFlag.test.ts`.
 *
 * Both are green regression guards.
 */
test.describe(
  'A ghosted placement flag does not survive into a rebuilt node',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      humanOpsHost: 'apply'
    })

    test('a node placed through the search box is still selectable after a browser reload', async ({
      agentConversation
    }, testInfo) => {
      test.setTimeout(120_000)

      await agentConversation.runTurns()

      const nodeId =
        await test.step('place a node while it follows the cursor', async () => {
          const added =
            await agentConversation.addNoteThroughSearchBox(PLACEMENT)
          await expect(
            agentConversation.vueNodes.getNodeLocator(added)
          ).toBeVisible()
          const outcomes = await agentConversation.waitForHumanOps(1)
          expect(
            outcomes.filter((outcome) => outcome.outcome === 'rejected')
          ).toEqual([])
          // The node really was a ghost at the moment the op was minted from
          // it; without this the rest of the test proves nothing.
          expect(agentConversation.placementWasGhosted).toBe(true)
          return added
        })

      await test.step('neither the live canvas nor the document kept the flag', async () => {
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).not.toHaveAttribute('data-ghost')
        await expect
          .poll(() => agentConversation.hostNode(nodeId)?.flags)
          .not.toHaveProperty('ghost')
      })

      await test.step('reload with no local workflow, so the node can only come back from the document', async () => {
        const before = agentConversation.subscribeCount()
        await agentConversation.reloadWithoutLocalWorkflow()
        await agentConversation.sendPrompt()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(before)
      })

      await test.step('the rebuilt node is solid, clickable and selectable', async () => {
        await agentConversation.attachEvidence(testInfo, 'after-reload')
        const node = agentConversation.vueNodes.getNodeLocator(nodeId)
        await expect(node).toBeVisible()
        await expect(node).not.toHaveAttribute('data-ghost')
        await expect(node).not.toHaveClass(/pointer-events-none/)

        await agentConversation.vueNodes.selectNode(nodeId)
        await expect(agentConversation.vueNodes.selectedNodes).toHaveCount(1)
        await expect(node).toHaveClass(/outline-node-component-outline/)
      })
    })

    test('a node the agent adds carrying a ghost flag is not handed back as a ghost', async ({
      agentConversation
    }, testInfo) => {
      test.setTimeout(120_000)

      await agentConversation.runTurns()

      const placedId =
        await test.step('place a node through the search box', async () => {
          const added =
            await agentConversation.addNoteThroughSearchBox(PLACEMENT)
          await agentConversation.waitForHumanOps(1)
          expect(agentConversation.placementWasGhosted).toBe(true)
          return added
        })

      // The document's own snapshot of that node, with the flag put back on.
      // This client's mint strips it (the first test asserts that), so the
      // payload is constructed rather than captured — the point here is the
      // READ side: an `add_node` arriving with `ghost: true` is exactly what a
      // peer, an older writer, or an agent edit that copied a stale snapshot
      // sends, and the op vocabulary inserts `node` verbatim.
      const replacementId = String(Number(placedId) + 1000)
      const pos = [PLACEMENT.x + 320, PLACEMENT.y]

      await test.step('the agent adds a node whose snapshot is still ghosted', async () => {
        const source = agentConversation.hostNode(placedId)
        if (!source) throw new Error('the document lost the placed node')
        agentConversation.pushHostOps([
          {
            op: 'add_node',
            node_id: replacementId,
            class_type: source.type,
            pos,
            node: {
              ...source,
              id: replacementId,
              pos,
              flags: { ...source.flags, ghost: true }
            }
          }
        ])
        await expect(
          agentConversation.vueNodes.getNodeLocator(replacementId)
        ).toBeVisible()
      })

      await test.step('the node the agent added is solid, clickable and selectable', async () => {
        await agentConversation.attachEvidence(testInfo, 'after-agent-add')
        const node = agentConversation.vueNodes.getNodeLocator(replacementId)
        await expect(node).not.toHaveAttribute('data-ghost')
        await expect(node).not.toHaveClass(/pointer-events-none/)

        await agentConversation.vueNodes.selectNode(replacementId)
        await expect(agentConversation.vueNodes.selectedNodes).toHaveCount(1)
        await expect(node).toHaveClass(/outline-node-component-outline/)
      })
    })
  }
)
