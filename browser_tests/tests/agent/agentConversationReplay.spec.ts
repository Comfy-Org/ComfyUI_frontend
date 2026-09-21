import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { listRecordedConversations } from '@e2e/fixtures/data/agent/agentConversation'
import { toNodeId } from '@/types/nodeId'

// A recording whose second turn wires two nodes; the first turn only adds.
const WIRING_CASE = 'agent-rec-two-turn-dependent-edit'
const WIDGET_CASE = 'agent-rec-set-widget-existing'

test.describe('Agent conversation replay', { tag: '@cloud' }, () => {
  test.describe('wire evidence', () => {
    test.use({ conversationCase: WIRING_CASE })

    // The second turn's only edit is a connect, so what the canvas shows after
    // it is the wire itself: the app's own render loop paints it, and the
    // expectation is the picture, not a reconstruction of the renderer.
    test('paints the wire the second turn connects @screenshot', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      await expect(page.locator('#graph-canvas')).toHaveScreenshot(
        'two-turn-dependent-edit-wired.png',
        { mask: [agentConversation.panel] }
      )
    })
  })

  test.describe('live widget effects', () => {
    test.use({ conversationCase: WIDGET_CASE })

    test('refreshes dependent combo options after an agent widget edit', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns(() =>
        page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)
          const steps = node?.widgets?.find((widget) => widget.name === 'steps')
          if (!steps) throw new Error('KSampler steps widget not found')
          steps.callback = (_value, _canvas, owner) => {
            const sampler = owner?.widgets?.find(
              (widget) => widget.name === 'sampler_name'
            )
            if (!sampler) throw new Error('KSampler sampler widget not found')
            sampler.options.values = ['euler', 'heun']
          }
        }, toNodeId(3))
      )

      const sampler = agentConversation.vueNodes
        .getNodeLocator('3')
        .getByRole('combobox', { name: 'sampler_name', exact: true })
      await sampler.click()
      await expect(page.getByRole('option', { name: 'heun' })).toBeVisible()
      await expect(sampler).not.toHaveAttribute('aria-invalid')
    })
  })

  for (const conversationCase of listRecordedConversations()) {
    test.describe(`recorded ${conversationCase}`, () => {
      test.use({ conversationCase })

      test('replays every recorded turn onto the panel and the canvas', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)
        await agentConversation.runTurns()

        await expect(
          agentConversation.panel.getByRole('button', {
            name: `Open ${agentConversation.conversation.workflow.name}`
          })
        ).toBeVisible()
      })
    })
  }
})
