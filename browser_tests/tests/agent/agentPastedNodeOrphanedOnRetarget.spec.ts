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

// A canvas paste used to call `graph.add(node)` before the pasted
// position was set, so the `add_node` the follower minted into the doc carried
// the constructor default `[10, 10]`. The paste looked right locally, but the
// next resubscribe (here, leaving and returning to the tab) replayed the doc's
// position over the live node.
test.describe(
  'pasted node survives a doc retarget',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({ conversationCase: SEED_CASE })

    test('a node pasted right before a workflow-tab switch keeps its pasted position after the follower resubscribes', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const topbar = new Topbar(page)

      // The follower binds and subscribes on the first turn's ack.
      await agentConversation.runTurns()
      const before = await readNodes(page)
      expect(before.length).toBeGreaterThan(0)

      const pasted =
        await test.step('copy and paste an existing seed node', async () => {
          await agentConversation.vueNodes.selectNode(before[0].id)
          await page.keyboard.press('ControlOrMeta+c')
          await page.keyboard.press('ControlOrMeta+v')
          await expect
            .poll(async () => (await readNodes(page)).length)
            .toBe(before.length + 1)
          const beforeIds = new Set(before.map((node) => node.id))
          const node = (await readNodes(page)).find(
            (candidate) => !beforeIds.has(candidate.id)
          )
          if (!node) throw new Error('paste did not add a new node')
          return node
        })

      expect(pasted.pos).not.toEqual([10, 10])

      await test.step('open a new tab and return, retargeting the bound doc', async () => {
        const beforeSubscribes = agentConversation.subscribeCount()
        await topbar.newWorkflowButton.click()
        await expect(
          topbar.workflowTabs.locator('.p-togglebutton')
        ).toHaveCount(2)
        await topbar.getTab(0).click()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(beforeSubscribes)
      })

      await test.step('the pasted node is still where it was pasted', async () => {
        await expect
          .poll(
            async () =>
              (await readNodes(page)).find((node) => node.id === pasted.id)?.pos
          )
          .toEqual(pasted.pos)
      })
    })
  }
)
