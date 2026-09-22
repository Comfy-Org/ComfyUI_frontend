import { expect } from '@playwright/test'

import { toNodeId } from '@/types/nodeId'

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

// A projection-dependent read that follows a real CRDT round trip or a
// graph reload; the default 5s budget is too tight for CI, matching the
// subscribe wait `agentAutogrowHandWiredLinkFixture.ts` widens for the
// same reason.
const SETTLE_TIMEOUT = 20_000

test.describe(
  'A hand-wired autogrow link survives a later agent turn',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('keeps the hand-wired link on its own slot name after the agent reconnects another slot and sends', async ({
      autogrowHandWiredLink
    }) => {
      const { page, readImageInputs } = autogrowHandWiredLink

      const readAutogrowLinks = async () =>
        linksOnAutogrowNode(
          await page.evaluate(
            async () => (await window.app!.graphToPrompt()).workflow
          )
        )

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

      const versionBeforeReload = await page.evaluate(
        () => window.app!.graph._version
      )

      // A serialize/reload round trip re-derives everything from the
      // exported JSON alone; the same attribution has to survive it. The
      // node id surviving `loadGraphData` proves nothing by itself — ids are
      // preserved by the reload itself — so the gate below waits for the
      // graph's version counter to move, which only happens once `clean()`
      // and `configure()` have actually run.
      await page.evaluate((wf) => window.app!.loadGraphData(wf), serialized)
      await page.waitForFunction(
        ({ id, versionBeforeReload }) => {
          const graph = window.app!.graph
          return (
            graph.getNodeById(id) !== null &&
            graph._version !== versionBeforeReload
          )
        },
        { id: toNodeId(GPT_NODE_ID), versionBeforeReload }
      )

      await expect
        .poll(readImageInputs, { timeout: SETTLE_TIMEOUT })
        .toEqual(expectedImageInputs)

      // Retries: autogrow's post-configure slot growth is scheduled on a
      // `requestAnimationFrame`, so the exported links can still lag a frame
      // behind the input-slot state the poll above just settled on.
      await expect
        .poll(readAutogrowLinks, { timeout: SETTLE_TIMEOUT })
        .toEqual(expectedLinks)
    })
  }
)
