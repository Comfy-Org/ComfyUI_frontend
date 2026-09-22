import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { listRecordedConversations } from '@e2e/fixtures/data/agent/agentConversation'
import { toNodeId } from '@/types/nodeId'

import {
  BYTEDANCE_REFERENCE_NODE_TYPE,
  byteDanceReferenceNodeDef
} from '@e2e/fixtures/data/byteDanceReferenceNodeDef'
import { referenceGraphOps } from '@e2e/fixtures/data/minimaxAutogrowReload'
import { wireAndReopen } from '@e2e/fixtures/utils/minimaxAutogrowReload'

// A recording whose second turn wires two nodes; the first turn only adds.
const WIRING_CASE = 'agent-rec-two-turn-dependent-edit'
const WIDGET_CASE = 'agent-rec-set-widget-existing'

test.describe(
  'Agent conversation replay',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test.describe('wire evidence', () => {
      test.use({ conversationCase: WIRING_CASE })

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
            const steps = node?.widgets?.find(
              (widget) => widget.name === 'steps'
            )
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
  }
)

test.describe(
  'MiniMax-style autogrow reload',
  { tag: ['@agent', '@cloud', '@vue-nodes'] },
  () => {
    // The reference node is not in the recorded core subset, so its definition
    // is served through the conversation fixture's own /object_info payload.
    // Routing it separately is shadowed by that route and the node lands
    // unregistered, which silently disarms this regression.
    test.use({
      conversationCase: WIRING_CASE,
      extraNodeDefs: {
        [BYTEDANCE_REFERENCE_NODE_TYPE]: byteDanceReferenceNodeDef
      }
    })

    // PM-993: the saved document addresses inputs by index, so growing the
    // next reference image on reopen used to re-target every wire below it.
    test('keeps widget links after a reference input grows', async ({
      agentConversation,
      page
    }) => {
      await test.step('Establish the agent conversation', async () => {
        await agentConversation.runTurns()
      })

      await test.step('Materialize the reference node and its sources', async () => {
        await agentConversation.applyGraphOps(referenceGraphOps)
      })

      await test.step('Connect and reopen without changing named wire targets', async () => {
        const wiring = await wireAndReopen(page)

        expect(wiring).toEqual({
          hasNextReference: true,
          referenceLinked: true,
          seedLinkBefore: expect.any(Number),
          seedLinkAfter: wiring.seedLinkBefore
        })
      })
    })
  }
)
