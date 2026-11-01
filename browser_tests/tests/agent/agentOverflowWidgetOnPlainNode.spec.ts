import { expect } from '@playwright/test'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { overflowPlainNodeTest as test } from '@e2e/tests/agent/agentOverflowPlainNodeFixture'
import { OVERFLOW_PLAIN_NODE_ID } from '@e2e/fixtures/data/agent/overflowWidgetPlainNode'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

test.describe(
  'Agent document carrying an overflow widget on a node without a dynamic combo',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('applies the overflow value the pinned catalog cannot name', async ({
      page,
      overflowPlainHost
    }) => {
      test.setTimeout(60_000)

      const vueNodes = new VueNodeHelpers(page)
      const agentPanel = new AgentPanel(page)
      const panel = agentPanel.root

      await test.step('open the agent panel and target the workflow', async () => {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
      })

      await test.step('send a turn so the session binds the workflow', async () => {
        const composer = agentPanel.composer
        await composer.fill('hello')
        await panel.getByRole('button', { name: enMessages.agent.send }).click()
        await expect(panel.getByText('hello').first()).toBeVisible()
        overflowPlainHost.endTurn()
        await overflowPlainHost.socket.waitForSubscribe()
      })

      const node = vueNodes.getNodeLocator(String(OVERFLOW_PLAIN_NODE_ID))
      await expect(node).toBeVisible()

      await test.step('the catalog-named widget applies, as it always did', async () => {
        await expect(
          node.getByRole('spinbutton', { name: 'known' })
        ).toHaveValue('11')
      })

      await test.step('the aliased widget applies instead of being dropped', async () => {
        await expect(
          node.getByRole('spinbutton', { name: 'added_after_catalog' })
        ).toHaveValue('99')
      })

      await test.step('a later document frame updates it too', async () => {
        overflowPlainHost.socket.send(
          overflowPlainHost.doc.replaceDocumentWidgets(OVERFLOW_PLAIN_NODE_ID, [
            ['known', 12],
            ['_extra_1', 77]
          ])
        )
        await expect(
          node.getByRole('spinbutton', { name: 'known' })
        ).toHaveValue('12')
        await expect(
          node.getByRole('spinbutton', { name: 'added_after_catalog' })
        ).toHaveValue('77')
      })
    })
  }
)
