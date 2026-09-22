import { expect } from '@playwright/test'

import { toNodeId } from '@/types/nodeId'

import {
  GPT_NODE_ID,
  IMAGE_1_NAME,
  IMAGE_2_NAME,
  IMAGE_3_NAME,
  SOURCE_AGENT_ID,
  SOURCE_HAND_ID,
  autogrowHandWiredLinkTest as test,
  sendSecondTurnAndReconnectFirstSlot
} from '@e2e/fixtures/agentAutogrowHandWiredLinkFixture'

interface SerializedLink {
  originNodeId: string
  targetSlotName: string | undefined
}

/**
 * The exported workflow's links, resolved to the name of the slot each one
 * targets on the autogrow node — the same "slot name of a link" reading
 * `readAutogrowInputGroup` (`nodeInputLinks.ts`) does for the plain-canvas
 * case, done inline here because this graph never carries an autogrow
 * fixture the shared helper's node-id/prefix contract would apply to
 * unmodified.
 */
function linksOnAutogrowNode(serialized: {
  nodes: { id: number | string; inputs?: { name: string; link?: unknown }[] }[]
  links?: unknown[]
}): SerializedLink[] {
  const node = serialized.nodes.find(
    (candidate) => String(candidate.id) === String(GPT_NODE_ID)
  )
  const linksById = new Map(
    (serialized.links ?? []).map((raw) => {
      const [id, originNodeId] = raw as [number, number]
      return [id, String(originNodeId)]
    })
  )
  return (node?.inputs ?? [])
    .filter((input) => typeof input.link === 'number')
    .map((input) => ({
      originNodeId: linksById.get(input.link as number) ?? '',
      targetSlotName: input.name
    }))
}

const expectedImageInputs = [
  { name: IMAGE_1_NAME, originNodeId: String(SOURCE_AGENT_ID) },
  { name: IMAGE_2_NAME, originNodeId: String(SOURCE_HAND_ID) },
  { name: IMAGE_3_NAME, originNodeId: null }
]

const expectedLinks = expect.arrayContaining([
  { originNodeId: String(SOURCE_AGENT_ID), targetSlotName: IMAGE_1_NAME },
  { originNodeId: String(SOURCE_HAND_ID), targetSlotName: IMAGE_2_NAME }
])

test.describe(
  'A hand-wired autogrow link survives a later agent turn',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('keeps the hand-wired link on its own slot name after the agent reconnects another slot and sends', async ({
      autogrowHandWiredLink
    }) => {
      const { page, readImageInputs } = autogrowHandWiredLink

      await sendSecondTurnAndReconnectFirstSlot(autogrowHandWiredLink)

      // The point of the fix: the agent's turn reconnected the first slot to
      // a different source, but the hand-wired second slot kept its own name
      // and its own link — it neither disappeared nor got relabelled to
      // whichever slot the agent's turn touched.
      await expect.poll(readImageInputs).toEqual(expectedImageInputs)

      const serialized = await page.evaluate(
        async () => (await window.app!.graphToPrompt()).workflow
      )
      expect(linksOnAutogrowNode(serialized)).toEqual(expectedLinks)

      // A serialize/reload round trip re-derives everything from the
      // exported JSON alone; the same attribution has to survive it.
      await page.evaluate((wf) => window.app!.loadGraphData(wf), serialized)
      await page.waitForFunction(
        (id) => window.app!.graph.getNodeById(id) !== null,
        toNodeId(GPT_NODE_ID)
      )

      await expect.poll(readImageInputs).toEqual(expectedImageInputs)

      const reserialized = await page.evaluate(
        async () => (await window.app!.graphToPrompt()).workflow
      )
      expect(linksOnAutogrowNode(reserialized)).toEqual(expectedLinks)
    })
  }
)
