import type { Locator } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

test.describe(
  'Subgraph input widget lifecycle',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test('creates widgets in both directions and recreates a disconnected input for a different widget', async ({
      comfyPage,
      comfyMouse
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-promoted-text'
      )
      await comfyPage.vueNodes.enterSubgraph('11')
      const first = await comfyPage.nodeOps.getNodeRefByType('KSampler', true)
      await comfyPage.searchBoxV2.addNode('KSampler', {
        position: { x: 950, y: 350 }
      })
      const samplers = await comfyPage.nodeOps.getNodeRefsByType(
        'KSampler',
        true
      )
      const second = samplers.find((node) => node.id !== first.id)
      if (!second)
        throw new Error('Expected the second KSampler from node search')
      const firstNode = new VueNodeFixture(
        comfyPage.vueNodes.getNodeLocator(String(first.id))
      )
      const secondNode = new VueNodeFixture(
        comfyPage.vueNodes.getNodeLocator(String(second.id))
      )
      const panel = comfyPage.page.getByTestId('subgraph-input-values')
      const empty = panel
        .getByTestId('subgraph-add-input')
        .getByTestId('slot-connection-dot')
      const steps = panel
        .getByTestId('subgraph-input-port')
        .filter({ hasText: /^steps$/ })
        .getByTestId('slot-connection-dot')
      const seedMaximum = await firstNode.root
        .getByRole('spinbutton', { name: 'seed', exact: true })
        .getAttribute('aria-valuemax')
      if (!seedMaximum) throw new Error('Expected the native seed maximum')

      async function dragSockets(source: Locator, target: Locator) {
        const from = await source.boundingBox()
        const to = await target.boundingBox()
        if (!from || !to)
          throw new Error('Expected both visible socket controls')
        await comfyMouse.dragAndDrop(
          { x: from.x + from.width / 2, y: from.y + from.height / 2 },
          { x: to.x + to.width / 2, y: to.y + to.height / 2 }
        )
      }

      await test.step('An empty output dragged to a widget input creates its native promoted control', async () => {
        await firstNode.getSlot('steps').hover()
        await dragSockets(empty, firstNode.getSlot('steps'))
        await expect(panel.getByTestId('subgraph-input-port')).toHaveCount(7)
        await expect(
          panel.getByRole('spinbutton', { name: 'steps', exact: true })
        ).toHaveValue('20')
        await expect(empty).toHaveCount(1)
      })

      await test.step('The input can feed two widgets before the modifier disconnects all links', async () => {
        await secondNode.getSlot('steps').hover()
        await dragSockets(steps, secondNode.getSlot('steps'))
        await expect
          .poll(() =>
            comfyPage.vueNodes.isSlotConnected(firstNode.getSlot('steps'))
          )
          .toBe(true)
        await expect
          .poll(() =>
            comfyPage.vueNodes.isSlotConnected(secondNode.getSlot('steps'))
          )
          .toBe(true)
        await steps.click({ modifiers: ['Control', 'Alt'] })
        await expect
          .poll(() =>
            comfyPage.vueNodes.isSlotConnected(firstNode.getSlot('steps'))
          )
          .toBe(false)
        await expect
          .poll(() =>
            comfyPage.vueNodes.isSlotConnected(secondNode.getSlot('steps'))
          )
          .toBe(false)
        await expect(steps).toHaveCount(1)
        await expect(
          panel.getByRole('spinbutton', { name: 'steps', exact: true })
        ).toHaveCount(0)
      })

      await test.step('Reconnecting the named port to seed generates the new native widget and options', async () => {
        await firstNode.getSlot('seed').hover()
        await dragSockets(steps, firstNode.getSlot('seed'))
        const seed = panel.getByRole('spinbutton', {
          name: 'steps',
          exact: true
        })
        await expect(seed).toHaveValue('20')
        await expect(seed).toHaveAttribute('aria-valuemax', seedMaximum)
        await expect(
          panel.getByRole('button', { name: 'Randomize Value', exact: true })
        ).toBeVisible()
        await expect(panel.getByTestId('subgraph-input-port')).toHaveCount(7)
      })

      await test.step('Dragging a different widget input to the empty output creates another fresh control', async () => {
        await firstNode.getSlot('cfg').hover()
        await dragSockets(firstNode.getSlot('cfg'), empty)
        await expect(panel.getByTestId('subgraph-input-port')).toHaveCount(8)
        await expect(
          panel.getByRole('spinbutton', { name: 'cfg', exact: true })
        ).toHaveValue('8.0')
        await expect(empty).toHaveCount(1)
      })
    })
  }
)
