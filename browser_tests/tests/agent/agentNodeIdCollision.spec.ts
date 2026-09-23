import {
  driveCollision,
  idCollisionTest as test
} from '@e2e/fixtures/agentCrdtIdCollisionFixture'
import { expect } from '@playwright/test'

/**
 * Two node-id failure modes, one fixed here and one NOT.
 *
 * FIXED (covered by unit tests, not these specs): the frontend
 * (`idAllocation.ts`) and the server-side agent used to mint node ids for the
 * same bound CRDT doc from ranges that could overlap, so both could
 * independently choose one id. A doc-bound root graph now mints from a
 * disjoint range (`'crdt-disjoint'` mode), which makes that overlap
 * impossible by construction — see `idAllocation.property.test.ts`,
 * `LGraph.test.ts` and `AgentPanelRoot.test.ts`.
 *
 * NOT FIXED, and what these two `test.fail()` specs pin: when two writes do
 * land on the same node id — by any route, including a user and the agent
 * editing concurrently after a reconnect, an id replayed from an older
 * document, or any future mint path that stops respecting the range split —
 * `comfy-multi-player`'s applier resolves the shared `["node", id]` register
 * as pure last-write-wins over `(base_version, actor, op_id)` and DROPS the
 * loser silently (`"lww-dropped"`), surfacing no error to either actor.
 * Symptoms:
 *
 *   1. the write that lost is wiped from the canvas on the next full
 *      reconcile
 *   2. a phantom node (here a blank Save Image) appears in its place
 *   3. the agent's own canonical graph read disagrees with the still-visible
 *      canvas, because the drop is never surfaced or reconciled
 *
 * Nothing in this PR addresses that silent drop, so do not read a closed
 * tracking item, or the disjoint-mint fix shipping, as covering it: these
 * specs stay `test.fail()` until the applier (or the actors around it)
 * surface a same-id conflict instead of swallowing one write. Tracked in
 * https://github.com/Comfy-Org/ComfyUI_frontend/issues/18414 — flip
 * `test.fail()` away once the underlying behavior is fixed and these
 * assertions start passing (issue closure alone is not that signal: it could
 * close as stale, a duplicate, or out of scope while the behavior below is
 * still broken); the assertions below should not otherwise change.
 *
 * `agentCrdtIdCollisionFixture` drives the real duplicate-via-context-menu
 * path so the id is genuinely minted by `idAllocation.ts` and the outbound
 * `doc_ops` frame is genuinely produced by `opSender`/`layoutMintPort`, then
 * aims the agent's competing write at that same id (a collision now has to
 * be forced — see the fixture's module doc). Both writes resolve through the
 * unmodified production applier (`@comfyorg/comfy-multi-player`'s
 * `applyOps`), not a hand-rolled stand-in for it.
 *
 * Both share `driveCollision` (in the fixture) for setup. Its own assertions
 * run before either test's `test.fail()`, so a setup regression there still
 * fails the run — see its doc comment for why that ordering is what makes
 * the guard effective, not the `test.fail()` call itself.
 */
test.describe(
  'Agent/frontend node id collision: silent last-write-wins drop',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test(
      'wipes a duplicated node and replaces it with a phantom node when ' +
        "the agent's write lands on the same id",
      async ({ idCollision }, testInfo) => {
        const { nodeId, agentUpdate } = await driveCollision(idCollision)

        await testInfo.attach('before-collision-duplicate-visible', {
          body: await idCollision.page.screenshot(),
          contentType: 'image/png'
        })

        // The agent's winning write reaches the client exactly as a live
        // `doc_update` broadcast would.
        idCollision.deliver(agentUpdate)

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
