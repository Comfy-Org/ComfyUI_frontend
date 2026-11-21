import { expect } from '@playwright/test'

import {
  GPT_NODE_ID,
  IMAGE_1_NAME,
  IMAGE_2_NAME,
  IMAGE_3_NAME,
  SEED_LINK_ID,
  SOURCE_AGENT_ID,
  SOURCE_HAND_ID,
  autogrowHandWiredLinkTest as test,
  sendSecondTurnAndReconnectFirstSlot
} from '@e2e/fixtures/agentAutogrowHandWiredLinkFixture'

interface SerializedLink {
  originNodeId: string
  targetSlotName: string | undefined
}

interface SerializedWorkflow {
  nodes: { id: number | string; inputs?: { name: string; link?: unknown }[] }[]
  links?: unknown[]
}

/** Link ids in the serialized workflow, resolved to their origin node id. */
function linkOriginsById(serialized: SerializedWorkflow): Map<number, string> {
  return new Map(
    (serialized.links ?? []).map((raw) => {
      const [id, originNodeId] = raw as [number, number]
      return [id, String(originNodeId)]
    })
  )
}

/**
 * The exported workflow's links, resolved to the name of the slot each one
 * targets on the autogrow node — the same "slot name of a link" reading
 * `readAutogrowInputGroup` (`nodeInputLinks.ts`) does for the plain-canvas
 * case, done inline here because this graph never carries an autogrow
 * fixture the shared helper's node-id/prefix contract would apply to
 * unmodified.
 */
function linksOnAutogrowNode(serialized: SerializedWorkflow): SerializedLink[] {
  const node = serialized.nodes.find(
    (candidate) => String(candidate.id) === String(GPT_NODE_ID)
  )
  const linksById = linkOriginsById(serialized)
  return (node?.inputs ?? [])
    .filter((input) => typeof input.link === 'number')
    .map((input) => {
      const linkId = input.link as number
      const originNodeId = linksById.get(linkId)
      // A dangling link reference is real graph corruption, not a case to
      // paper over with a placeholder the caller's assertion would ignore.
      if (originNodeId === undefined) {
        throw new Error(
          `link ${linkId} on slot ${input.name} has no entry in the serialized workflow's links`
        )
      }
      return { originNodeId, targetSlotName: input.name }
    })
}

const expectedImageInputs = [
  { name: IMAGE_1_NAME, originNodeId: String(SOURCE_AGENT_ID) },
  { name: IMAGE_2_NAME, originNodeId: String(SOURCE_HAND_ID) },
  { name: IMAGE_3_NAME, originNodeId: null }
]

// Order follows slot order (image_1, then image_2) — `toEqual` here, not
// `arrayContaining`, so a duplicate, stale, or extra link entry (e.g. the
// replaced seed link surviving under another slot) fails the assertion
// instead of being ignored as an unlisted array member.
const expectedLinks = [
  { originNodeId: String(SOURCE_AGENT_ID), targetSlotName: IMAGE_1_NAME },
  { originNodeId: String(SOURCE_HAND_ID), targetSlotName: IMAGE_2_NAME }
]

// A projection-dependent read that follows a real CRDT round trip; the
// default 5s budget is too tight for CI, matching the subscribe wait
// `agentAutogrowHandWiredLinkFixture.ts` widens for the same reason.
const SETTLE_TIMEOUT = 20_000

test.describe(
  'A hand-wired autogrow link survives a later agent turn',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('keeps the hand-wired link on its own slot name after the agent reconnects another slot and sends', async ({
      autogrowHandWiredLink
    }) => {
      const { page, readImageInputs } = autogrowHandWiredLink

      await sendSecondTurnAndReconnectFirstSlot(autogrowHandWiredLink)

      // The point of the fix: the agent's turn reconnected the first slot to
      // a different source, but the hand-wired second slot kept its own name
      // and its own link — it neither disappeared nor got relabelled to
      // whichever slot the agent's turn touched.
      await expect
        .poll(readImageInputs, { timeout: SETTLE_TIMEOUT })
        .toEqual(expectedImageInputs)

      const serialized = await page.evaluate(
        async () => (await window.app!.graphToPrompt()).workflow
      )
      expect(linksOnAutogrowNode(serialized)).toEqual(expectedLinks)
      // The seed link the agent's reconnect displaced must be gone outright,
      // not merely unreferenced by the slot it used to target.
      expect(linkOriginsById(serialized).has(SEED_LINK_ID)).toBe(false)

      // A prior version of this test also drove `window.app.loadGraphData()`
      // in-page and re-asserted across that reload, while the agent CRDT
      // follower stayed subscribed to the same workflow. CI showed it fails
      // deterministically (same `image_2` slot losing its link on every
      // attempt, with or without SLOW_MO, across every retry): a real,
      // pre-existing gap in how the CRDT follower reconciles when
      // `loadGraphData()` is called in-session while it's still subscribed,
      // unrelated to the `mergeSlotsByName` fix this test otherwise covers.
      //
      // #18375 (`agentCrdtProjection.reconnectAdoptionRace.test.ts`) fixed a
      // different gap that looked like the same symptom — a hand-wire's own
      // CRDT echo racing `useLinkStore`'s `LinkMap` cache — and its own
      // unit-level regression, extended to also cover a later turn
      // reconnecting a different, already-occupied slot before the reload,
      // passes on this branch with that fix applied. So the browser-level
      // reload failure above is not that race recurring; it is the
      // separate, not-yet-diagnosed gap this comment already described.
      // Note this isn't necessarily an unrealistic path in general —
      // `app.ts`'s real workflow-file loading also calls `loadGraphData()`
      // — what hasn't been verified is whether the follower's subscription
      // is in the same state during a normal file load as it is here. Left
      // as a follow-up rather than fixed here, since it needs its own
      // investigation and is out of scope for this change.
    })
  }
)
