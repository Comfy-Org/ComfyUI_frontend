import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'

// Five wired seed nodes; the recorded turn only sets widget values, leaving
// every node in place to copy.
const SEED_CASE = 'agent-rec-set-widget-existing'

interface RenderedGraphNode {
  id: string
  pos: [number, number]
}

async function readNodes(page: Page): Promise<RenderedGraphNode[]> {
  return page.evaluate(() =>
    window.app!.graph.nodes.map((node) => ({
      id: String(node.id),
      pos: [node.pos[0], node.pos[1]] as [number, number]
    }))
  )
}

async function readGraphMouse(page: Page): Promise<[number, number]> {
  return page.evaluate(() => [
    window.app!.canvas.graph_mouse[0],
    window.app!.canvas.graph_mouse[1]
  ])
}

// A canvas paste used to call `graph.add(node)` before the pasted
// position was set, so the `add_node` the follower minted into the doc carried
// the constructor default `[10, 10]`. The paste looked right locally, but the
// next resubscribe (here, leaving and returning to the tab) replayed the doc's
// position over the live node.
test.describe(
  'pasted node survives a doc retarget',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: SEED_CASE, humanOpsHost: 'apply' })

    test('a node pasted right before a workflow-tab switch keeps its pasted position after the follower resubscribes', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      // The follower binds and subscribes on the first turn's ack.
      await agentConversation.runTurns()
      const before = await readNodes(page)
      expect(before.length).toBeGreaterThan(0)

      const pasted =
        await test.step('copy and paste an existing seed node', async () => {
          await agentConversation.vueNodes.selectNode(before[2].id)
          await page.keyboard.press('ControlOrMeta+c')
          await page.locator('#graph-canvas').hover({
            position: { x: 413, y: 547 }
          })
          await expect.poll(() => readGraphMouse(page)).not.toEqual([0, 0])
          const pastePosition = await readGraphMouse(page)
          expect(pastePosition[0]).not.toBe(pastePosition[1])
          await page.keyboard.press('ControlOrMeta+v')
          await expect
            .poll(async () => (await readNodes(page)).length)
            .toBe(before.length + 1)
          const beforeIds = new Set(before.map((node) => node.id))
          const node = (await readNodes(page)).find(
            (candidate) => !beforeIds.has(candidate.id)
          )
          if (!node) throw new Error('paste did not add a new node')
          expect(node.pos[0]).toBeCloseTo(pastePosition[0], 6)
          expect(node.pos[1]).toBeCloseTo(pastePosition[1], 6)
          return node
        })

      expect(pasted.pos).not.toEqual([10, 10])
      await expect
        .poll(() => agentConversation.hostNodePositions())
        .toContainEqual(pasted.pos)

      await test.step('open a new tab and return, retargeting the bound doc', async () => {
        const topbar = new Topbar(page)
        const beforeSubscribes = agentConversation.subscribeCount()
        await topbar.newWorkflowButton.click()
        await expect(topbar.tabs).toHaveCount(2)
        await topbar.getTab(0).click()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(beforeSubscribes)
        await expect
          .poll(
            async () =>
              (await readNodes(page)).find((node) => node.id === pasted.id)?.pos
          )
          .toEqual(pasted.pos)
      })

      await test.step('reload without local workflow state and subscribe a fresh follower', async () => {
        const beforeSubscribes = agentConversation.subscribeCount()
        await agentConversation.reloadWithoutLocalWorkflow()
        await agentConversation.sendPrompt()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(beforeSubscribes)
      })

      await test.step('the pasted node is still where it was pasted', async () => {
        await expect
          .poll(async () => (await readNodes(page)).map((node) => node.pos))
          .toContainEqual(pasted.pos)
      })
    })
  }
)
