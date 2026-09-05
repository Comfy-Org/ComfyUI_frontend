import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

const WORKFLOW = 'links/conflicting-origins'
const TARGET_NODE_ID = 2
const NAMED_ORIGIN_ID = 3

type LoadedLinkState = {
  liveLinksAtInput: { id: number; originId: number }[]
  inputLinkId: number | null
  resolvedOriginId: number | null
}

async function readTargetInputState(
  comfyPage: ComfyPage
): Promise<LoadedLinkState> {
  return comfyPage.page.evaluate(
    (targetId) => {
      const graph = window.app!.graph
      const target = graph.getNodeById(targetId)
      if (!target) throw new Error(`Target node ${targetId} not found`)
      const input = target.inputs[0]
      const liveLinksAtInput = [...graph.links.values()]
        .filter(
          (l) =>
            String(l.target_id) === String(targetId) &&
            Number(l.target_slot) === 0
        )
        .map((l) => ({ id: Number(l.id), originId: Number(l.origin_id) }))
      const inputLinkId = input.link
      const live = inputLinkId != null ? graph.getLink(inputLinkId) : null
      return {
        liveLinksAtInput,
        inputLinkId: inputLinkId == null ? null : Number(inputLinkId),
        resolvedOriginId: live ? Number(live.origin_id) : null
      }
    },
    toNodeId(String(TARGET_NODE_ID))
  )
}

// Soak S4 / #15577: the fixture carries two link records into the same input
// — document order lists Origin A (link 4) first, while the file's own
// input.link names Origin B (link 5). The branch's normalizeConfiguredTopology
// keeps exactly one record, silently.
test.describe(
  'Conflicting-origin links on workflow load',
  { tag: ['@canvas', '@node'] },
  () => {
    test('load keeps exactly one live link at the contested input', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      const state = await readTargetInputState(comfyPage)
      expect(
        state.liveLinksAtInput,
        `contested input must not keep both records — got ${JSON.stringify(state)}`
      ).toHaveLength(1)
      expect(state.inputLinkId, 'input.link must resolve to a live link').toBe(
        state.liveLinksAtInput[0].id
      )
    })

    // WANTED behaviour, pinned while #15577 is open: the survivor must be the
    // link the file's own input.link names (Origin B), not the first record
    // in document order. Flips to unexpected-pass when #15577 is fixed.
    test('the survivor is the link input.link names', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      const state = await readTargetInputState(comfyPage)
      // Armed only after load succeeded, so setup errors fail the test
      // instead of satisfying the pin.
      test.fail()
      expect(
        state.resolvedOriginId,
        `input must stay wired to the origin the file names — got ${JSON.stringify(state)}`
      ).toBe(NAMED_ORIGIN_ID)
    })

    // WANTED behaviour, pinned: dropping a link on load must not be silent.
    test('dropping a conflicting link warns on the console', async ({
      comfyPage
    }) => {
      const warnings: string[] = []
      comfyPage.page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          warnings.push(message.text())
        }
      })
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await readTargetInputState(comfyPage)
      test.fail()
      // Anchored on the contested records so unrelated litegraph chatter
      // containing "link" cannot flip this pin to unexpected-pass.
      expect(
        warnings.filter(
          (text) =>
            /(conflict|duplicate|dropp?ed|discard)/i.test(text) &&
            /\b(link|origin)\b/i.test(text)
        ),
        'a dropped link record must leave a console warning'
      ).not.toHaveLength(0)
    })

    // Part C of the soak scenario: whichever origin survives, a re-save must
    // not silently rewire the workflow again — the state after save/reload
    // must equal the state after the first load (rewrite reaches a fixed
    // point and is at least stable, if not yet correct).
    test('the surviving wiring is stable across serialize and reload', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      const firstLoad = await readTargetInputState(comfyPage)
      await comfyPage.subgraph.serializeAndReload()
      const afterReload = await readTargetInputState(comfyPage)
      expect(afterReload, 'wiring changed again on re-save').toEqual(firstLoad)
      expect(afterReload.liveLinksAtInput).toHaveLength(1)
    })
  }
)
