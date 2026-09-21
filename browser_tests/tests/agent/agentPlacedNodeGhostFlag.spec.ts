import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// Backfills the black-box half of #18191 ("keep the ghost placement flag out of
// the document"), which shipped with unit coverage only
// (src/workbench/extensions/agent/crdt/ghostPlacementFlag.test.ts and
// layoutMintPort.test.ts). Reported by Jo Zhang:
// https://github.com/Comfy-Org/ComfyUI_frontend/pull/18191
//
// `flags.ghost` is placement presentation state - "semi-transparent, following
// cursor" - and it leaked into the CRDT document, because the add_node mint
// snapshots the node while placement is still live and nothing carries the
// later clear. A full reconcile then re-read the document's flags and rendered
// the node dead: 60% opacity and `pointer-events-none`, with no route back,
// so the user could no longer click, select, move or delete a node they had
// just placed, and a reload did not clear it.
//
// The unit tests pin the document payload. What a user actually loses is the
// node's *interactivity*, so that is what this asserts: after the reconcile the
// placed node takes a real click and selects. Node survival across the same
// switch is already covered by agentHumanAddTabSwitch.spec.ts
// (FRONTEND_ONLY_VIA_SEARCH); this case is about the state it survives in.
const CASE = 'agent-rec-text-only-answer'
// The seed's "Positive prompt" CLIPTextEncode. A host edit to its text is the
// readiness boundary for "the frames pending on the follower have landed".
const PROMPT_NODE_ID = '6'
const PROMPT_WIDGET = 'text'
const ADD_POSITION = { x: 400, y: 400 }

test.describe(
  'A node placed through the search box stays interactive with Agent bound',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('stays clickable and selectable after a workflow tab switch', async ({
      agentConversation
    }, testInfo) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn', async () => {
        await agentConversation.runTurns()
        await agentConversation.installTabSwitchObserver()
      })

      // The search box is the path that puts the node into FollowCursor
      // placement, which is the only way flags.ghost is ever set. A direct
      // addNodeOfType add never goes through it and cannot reproduce this.
      const nodeId =
        await test.step('place a node through the search box and let the host judge it', async () => {
          const addedNodeId =
            await agentConversation.addNoteThroughSearchBox(ADD_POSITION)
          await expect(
            agentConversation.vueNodes.getNodeLocator(addedNodeId)
          ).toBeVisible()
          const outcomes = await agentConversation.waitForHumanOps(1)
          expect(
            outcomes.filter((outcome) => outcome.outcome === 'rejected')
          ).toEqual([])
          return addedNodeId
        })

      // Placement has finished, so the placement preview is already gone
      // locally. The regression only appears once something re-reads the
      // document, which the tab return does.
      await test.step('the placed node is interactive before any reconcile', async () => {
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).not.toHaveAttribute('data-ghost')
      })

      await test.step('switch to another tab and back', () =>
        agentConversation.switchAwayAndBack(PROMPT_NODE_ID, PROMPT_WIDGET))

      await test.step('the reconcile did not resurrect the placement flag', async () => {
        await agentConversation.attachEvidence(testInfo, 'after-return')
        const node = agentConversation.vueNodes.getNodeLocator(nodeId)
        await expect(node).toBeVisible()
        // The rendered consequences a user sees, asserted directly rather than
        // through the flag: a ghosted node draws at 60% of canvas opacity and
        // opts out of pointer events.
        await expect(node).not.toHaveAttribute('data-ghost')
        await expect(node).not.toHaveClass(/pointer-events-none/)
        await expect(node).toHaveCSS('opacity', '1')
      })

      await test.step('the user can still select the node they placed', async () => {
        // The decisive check. Under the regression the root carries
        // `pointer-events-none`, so this click lands on the canvas behind the
        // node and the selection outline never appears.
        await agentConversation.vueNodes.selectNode(nodeId)
        await expect(agentConversation.vueNodes.selectedNodes).toHaveCount(1)
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toHaveClass(/outline-node-component-outline/)
      })
    })
  }
)
