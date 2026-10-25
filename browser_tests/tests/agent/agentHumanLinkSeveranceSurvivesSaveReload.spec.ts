import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { AgentConversationHarness } from '@e2e/fixtures/agentConversationFixture'
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
// [1, 4, 1, 6, 0, 'CLIP'] in the seed: node 4's CLIP output into node 6's first
// input. Node 4 fans out to three consumers, so severing this one must leave
// the other two — the reporter noticed the bug precisely because a sibling link
// off the same node was still correct.
const SEVERED_LINK_ID = 1
const SEVERED_TARGET = { node: 6, slot: 0 }
const SURVIVING_LINK_IDS = [2, 3, 4, 5, 6]
const SEEDED_LINK_IDS = [SEVERED_LINK_ID, ...SURVIVING_LINK_IDS]
const SAVED_NAME = 'Severed link survives reload'
// Every link in the seed terminates on a node input, so the ids the host
// document reports as connected are exactly the `link` fields its projected
// nodes carry. Reading them that way keeps this pin inside
// `browser_tests/tests/agent/**` instead of adding a method to the shared
// conversation fixture, which many other specs import.
const SEED_NODE_IDS = ['3', '4', '6', '8', '9']

interface DraftGraph {
  links: unknown[]
  nodes: unknown[]
}

/**
 * The turn's own request to the agent. The workflow on it is the view the
 * reported bug was about: the agent answered from a graph that still carried
 * the severed connection, so asserting what actually leaves the page is what
 * proves the defect gone. `AgentConversationHarness` holds its `HostDoc` in the
 * Playwright worker, where it survives `page.reload()`, so a host-side read
 * alone cannot see a reload putting the link back into the outgoing draft.
 */
function promptRequest(page: Page): Promise<Request> {
  return page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      /\/api\/agent\/threads\/[^/]+\/messages$/.test(
        new URL(request.url()).pathname
      )
  )
}

function draftGraph(request: Request): DraftGraph {
  const posted = request.postData()
  const content: unknown = (
    JSON.parse(posted ?? 'null') as { draft?: { content?: unknown } } | null
  )?.draft?.content
  const graph = content as DraftGraph | undefined
  // Throw rather than return an empty graph: the assertions below are absence
  // checks, and an absence check over a silently-empty payload passes while
  // proving nothing.
  if (!Array.isArray(graph?.links) || !Array.isArray(graph.nodes))
    throw new Error(
      `the turn's POST carried no draft workflow to assert on: ${posted?.slice(0, 300) ?? '<no body>'}`
    )
  return graph
}

/** Link ids from a workflow's own link table, in either serialised shape. */
function linkIds(graph: DraftGraph): number[] {
  return graph.links
    .flatMap((link) => {
      const id = Array.isArray(link) ? link[0] : (link as { id?: unknown }).id
      return typeof id === 'number' ? [id] : []
    })
    .sort((a, b) => a - b)
}

function inputLinkIds(node: { inputs?: unknown } | undefined): number[] {
  const inputs = Array.isArray(node?.inputs) ? node.inputs : []
  return inputs.flatMap((input) => {
    if (typeof input !== 'object' || input === null) return []
    const { link } = input as { link?: unknown }
    return typeof link === 'number' ? [link] : []
  })
}

/** Which link, if any, a workflow says lands on one node input. */
function inputLinkAt(
  graph: DraftGraph,
  nodeId: number,
  slot: number
): number | null {
  const node = graph.nodes.find(
    (candidate) => (candidate as { id?: unknown }).id === nodeId
  ) as { inputs?: unknown } | undefined
  if (node === undefined)
    throw new Error(`the draft workflow has no node ${nodeId}`)
  const inputs = Array.isArray(node.inputs) ? node.inputs : []
  const link = (inputs[slot] as { link?: unknown } | undefined)?.link
  return typeof link === 'number' ? link : null
}

/**
 * The link ids the shared document holds — what a catch-up or a resubscribe
 * hands a replica, read from the library's own projection. A spec that only
 * asserted the canvas would pass while the bug was live, and a unit test on
 * either side alone cannot see a divergence between the two.
 */
function hostLinkIds(conversation: AgentConversationHarness): number[] {
  return SEED_NODE_IDS.flatMap((id) =>
    inputLinkIds(conversation.hostNode(id))
  ).sort((a, b) => a - b)
}

/** The link ids the canvas holds — what the user sees and what executes. */
async function canvasLinkIds(page: Page): Promise<number[]> {
  const ids = await page.evaluate(() =>
    [...window.app!.graph.links.keys()].map(Number)
  )
  return ids.sort((a, b) => a - b)
}

test.describe(
  'A human link severance survives save and reload in the agent-visible graph',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('keeps the severed connection out of the document the agent reads after a save and reload', async ({
      agentConversation,
      comfyPage,
      page
    }, testInfo) => {
      test.setTimeout(120_000)

      await agentConversation.persistSavedWorkflow()

      await test.step('bind the seeded workflow and record every view', async () => {
        const seededTurn = promptRequest(page)
        await agentConversation.runTurns()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(0)
        // The positive control for all three readers: the agent really is
        // handed the connection to begin with, so a later absence is a change
        // rather than a reader that never saw it.
        const seeded = draftGraph(await seededTurn)
        expect(linkIds(seeded)).toEqual(SEEDED_LINK_IDS)
        expect(
          inputLinkAt(seeded, SEVERED_TARGET.node, SEVERED_TARGET.slot)
        ).toBe(SEVERED_LINK_ID)
        expect(hostLinkIds(agentConversation)).toEqual(SEEDED_LINK_IDS)
        expect(await canvasLinkIds(page)).toEqual(SEEDED_LINK_IDS)
      })

      await test.step('the user severs one connection on the canvas', async () => {
        // Dropping a dragged link on empty canvas runs
        // `Comfy.LinkRelease.Action`, and under the default the release only
        // lands once the menu it opens is dismissed — `NodeSearchBoxPopover`
        // cancels litegraph's reset and calls `disconnectLinks()` from the
        // menu's abort handler. This pin is about the severance surviving a
        // save and a reload, not about which release action is configured, so
        // it takes the same `no action` route `linkNodeInteractionSettings`
        // and `interaction` already use for an unambiguous disconnect gesture.
        await comfyPage.settings.setSetting(
          'Comfy.LinkRelease.Action',
          'no action'
        )
        const targetNode = await comfyPage.nodeOps.getNodeRefById(
          SEVERED_TARGET.node
        )
        const targetInput = await targetNode.getInput(SEVERED_TARGET.slot)
        const emptyCanvasPosition = await page.evaluate(() => {
          const app = window.app!
          const canvas = app.canvas.canvas
          const bounds = canvas.getBoundingClientRect()

          for (let y = bounds.bottom - 40; y >= bounds.top + 40; y -= 40) {
            for (let x = bounds.left + 40; x <= bounds.right - 40; x += 40) {
              if (document.elementFromPoint(x, y) !== canvas) continue

              const [canvasX, canvasY] = app.clientPosToCanvasPos([x, y])
              if (!app.graph.getNodeOnPos(canvasX, canvasY, app.graph.nodes)) {
                return { x, y }
              }
            }
          }

          throw new Error('No visible empty canvas position found')
        })
        await comfyPage.canvasOps.dragAndDrop(
          await targetInput.getPosition(),
          emptyCanvasPosition
        )
        await targetInput.expectLinkCount(0)
        // Asserted as an exact set, not as "does not contain 1": a severance
        // that re-created the same 4:1 -> 6:0 edge under a fresh id would pass
        // an id-absence check and fail this one.
        await expect.poll(() => canvasLinkIds(page)).toEqual(SURVIVING_LINK_IDS)
        // Minted at the command site, not reverse-engineered from a store side
        // effect. `opLabel` has no id slot for a link op, so the op KIND is
        // what is assertable here; the document assertions are what prove the
        // right link went.
        await expect
          .poll(() =>
            agentConversation.humanOpFrames().flatMap((frame) => frame.ops)
          )
          .toEqual(
            expect.arrayContaining([expect.stringMatching(/^disconnect/)])
          )
      })

      await test.step('the severance reaches the agent-visible document', async () => {
        await expect
          .poll(() => hostLinkIds(agentConversation))
          .toEqual(SURVIVING_LINK_IDS)
        // The node must still be in the document: `hostLinkIds` reads link ids
        // off node inputs, so a regression that dropped node 6 altogether
        // would otherwise read as a clean severance.
        const severedNode = agentConversation.hostNode(
          String(SEVERED_TARGET.node)
        )
        expect(severedNode).toBeDefined()
        expect(inputLinkIds(severedNode)).toEqual([])
      })

      await test.step('the user saves and refreshes the page', async () => {
        await agentConversation.topbar.saveWorkflowAs(SAVED_NAME)
        const savedLinks = (
          (await agentConversation.savedWorkflowContent()).links ?? []
        )
          .map((link) => (Array.isArray(link) ? link[0] : link.id))
          .sort((a, b) => a - b)
        expect(savedLinks).toEqual(SURVIVING_LINK_IDS)
        const restored = page.waitForResponse(
          (response) =>
            response.request().method() === 'GET' &&
            decodeURIComponent(new URL(response.url()).pathname) ===
              `/api/userdata/workflows/${SAVED_NAME}.json`,
          { timeout: 60_000 }
        )
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(agentConversation.panel).toBeVisible({ timeout: 30_000 })
        const picker = agentConversation.panel.getByRole('button', {
          name: enMessages.agent.switchWorkflow
        })
        await picker.click()
        await page
          .getByRole('menuitemradio', { name: SAVED_NAME, exact: true })
          .click()
        await expect(picker).toHaveText(SAVED_NAME)
        expect((await restored).ok()).toBe(true)
        await expect.poll(() => canvasLinkIds(page)).toEqual(SURVIVING_LINK_IDS)
      })

      await test.step('the agent still reads the connection as gone', async () => {
        const before = agentConversation.subscribeCount()
        // Captured from the request the turn itself sends, so there is no
        // window between "the host announced a catch-up" and "the page acted
        // on it" for a re-minted connection to slip through unseen: the bytes
        // asserted here are the bytes the agent was handed.
        const reloadedTurn = promptRequest(page)
        await agentConversation.sendPrompt()
        const reloaded = draftGraph(await reloadedTurn)
        expect(linkIds(reloaded)).toEqual(SURVIVING_LINK_IDS)
        expect(
          inputLinkAt(reloaded, SEVERED_TARGET.node, SEVERED_TARGET.slot)
        ).toBeNull()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(before)
        await expect
          .poll(() => hostLinkIds(agentConversation))
          .toEqual(SURVIVING_LINK_IDS)
        await expect.poll(() => canvasLinkIds(page)).toEqual(SURVIVING_LINK_IDS)
      })

      const after = testInfo.outputPath('after-reload.png')
      await page.screenshot({ path: after })
      await testInfo.attach('after-reload', {
        path: after,
        contentType: 'image/png'
      })
    })
  }
)
