import { expect } from '@playwright/test'

import {
  driveCollision,
  idCollisionTest as test
} from '@e2e/fixtures/agentCrdtIdCollisionFixture'

/**
 * PM-1251 repro. Root cause (full RCA in the linked Slack thread / Linear
 * ticket): the frontend (`idAllocation.ts`'s local `++lastNodeId` counter,
 * used by both `LGraph.add` and the duplicate/paste path in
 * `LGraphCanvas.ts`) and the server-side agent independently mint node ids
 * for the SAME bound CRDT doc, with no shared reservation between them. When
 * both mint before observing the other's write, their `add_node` ops
 * collide on the applier's `["node", id]` register in `comfy-multi-player`,
 * which resolves the collision as pure last-write-wins over
 * `(base_version, actor, op_id)` and drops the loser as `"lww-dropped"` —
 * without surfacing an error to either actor. One mechanism, three symptoms:
 *
 *   1. a duplicated node is repeatedly wiped
 *   2. a phantom node (here a blank Save Image) appears in its place
 *   3. the agent's own canonical graph read disagrees with the still-visible
 *      canvas, because the drop is never surfaced or reconciled
 *
 * `agentCrdtIdCollisionFixture` drives the real duplicate-via-context-menu
 * path so the id is genuinely minted by `idAllocation.ts` and the outbound
 * `doc_ops` frame is genuinely produced by `opSender`/`layoutMintPort`; the
 * competing "agent" write and the collision resolution both run through the
 * unmodified production applier (`@comfyorg/comfy-multi-player`'s
 * `applyOps`), not a hand-rolled stand-in for it. See the fixture's module
 * doc for why this repro cannot be built on `agentConversationFixture`.
 *
 * Both tests are `test.fail()`: they assert the CORRECT/fixed behavior,
 * which the bug currently breaks. Flip `test.fail()` away once PM-1251 (or
 * PM-1250) ships a fix — the assertions below should not otherwise change.
 *
 * Both share `driveCollision` (in the fixture) for setup: duplicate the
 * seed node for real, then force the agent's write to collide on that same
 * id and resolve via the production applier. Its own assertions run before
 * either test's `test.fail()`, so a setup regression there still fails the
 * run — see its doc comment for why that ordering is what makes the guard
 * effective, not the `test.fail()` call itself.
 */
test.describe(
  'Agent/frontend node id collision (PM-1251)',
  { tag: ['@cloud', '@agent'] },
  () => {
    test(
      'wipes a duplicated node and replaces it with a phantom node when ' +
        'the agent independently mints the same id',
      async ({ idCollision }, testInfo) => {
        const { nodeId, agentApply } = await driveCollision(idCollision)

        await testInfo.attach('before-collision-duplicate-visible', {
          body: await idCollision.page.screenshot(),
          contentType: 'image/png'
        })

        // The agent's winning write reaches the client exactly as a live
        // `doc_update` broadcast would.
        idCollision.deliver(agentApply.frame)

        // PR #17963 (merged the day before this RCA) fixed the incremental
        // live-update path to patch a still-live node in place instead of
        // rebuilding it from the doc, so the wipe/phantom symptom now needs
        // the SAME whole-document reconcile a tab switch (or reconnect)
        // drives, against a doc that disagrees with the still-live orphan
        // at the collided id — see `forceReconcile()`'s doc comment.
        await idCollision.forceReconcile()

        await expect(idCollision.vueNodes.getNodeLocator(nodeId)).toBeVisible()
        await testInfo.attach('after-collision-wiped-and-phantom', {
          body: await idCollision.page.screenshot(),
          contentType: 'image/png'
        })

        test.fail()

        // Expected/fixed behavior: a node the user just duplicated is not
        // silently replaced by an unrelated node the agent happened to add
        // at the same id. Today this fails — the node at `nodeId` renders as
        // a blank Save Image, and the duplicate's own widget is gone.
        await expect(
          idCollision.vueNodes
            .getNodeLocator(nodeId)
            .getByLabel('text', { exact: true })
        ).toHaveValue('seed node, duplicate me')
      }
    )

    test(
      "leaves the agent's own graph read disagreeing with the " +
        'still-visible canvas after its write is silently dropped',
      async ({ idCollision }, testInfo) => {
        const { nodeId } = await driveCollision(idCollision)

        // Nothing is delivered back over /ws here — the drop is never
        // communicated to the client, so the canvas keeps showing the user's
        // own edit exactly as they made it (this part is not the bug).
        await expect(
          idCollision.vueNodes
            .getNodeLocator(nodeId)
            .getByLabel('text', { exact: true })
        ).toHaveValue('seed node, duplicate me')

        await testInfo.attach('canvas-vs-agent-desync', {
          body: await idCollision.page.screenshot(),
          contentType: 'image/png'
        })

        test.fail()

        // Expected/fixed behavior: what the agent reads as the canonical
        // graph (what it references when the user's next prompt asks it to
        // act on this node) should agree with what the user is looking at.
        // Today it does not — the doc's record at `nodeId` is the agent's
        // own Save Image, not the user's still-visible duplicate, and
        // nothing told either side the write never landed.
        const canonicalNode = idCollision.host
          .projection()
          .nodes.find((node) => String(node.id) === nodeId)
        expect(
          canonicalNode,
          `doc should still contain node ${nodeId}`
        ).toBeDefined()
        expect(canonicalNode?.type).toBe('CLIPTextEncode')
      }
    )
  }
)
