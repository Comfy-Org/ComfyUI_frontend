import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// Production signature (CLOUD-FRONTEND-PROD-2Z4, -2WK, -2S7, -25R): a person
// adds a subgraph blueprint while the Agent document is bound, then edits one
// of its promoted widgets. The host carries the blueprint's promoted values,
// but the document never received the blueprint's definition, so the minter
// cannot place the write and refuses it ("…stored values and declared inputs
// [] do not place; refusing to mint a promoted write"). The canvas keeps the
// edit, the shared document keeps the old value, and reload discards it.
const CASE = 'agent-rec-text-only-answer'
const PROMPT_NODE_ID = '6'
const PROMPT_WIDGET = 'text'
const ADD_POSITION: [number, number] = [400, 400]
const PROMOTED_WIDGET = 'text'
const EDITED_PROMPT = 'an edited blueprint prompt'

test.describe(
  'Promoted widget edit on a human-added subgraph blueprint with Agent bound',
  { tag: ['@cloud', '@agent', '@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('saves the edit to the shared document without a rejection notice', async ({
      agentConversation,
      comfyPage
    }) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn', () =>
        agentConversation.runTurns())

      const hostId =
        await test.step('add a blueprint that promotes its prompt', async () => {
          const added = await agentConversation.addBlueprint(true, ADD_POSITION)
          await expect(
            agentConversation.vueNodes.getNodeLocator(added)
          ).toBeVisible()
          const outcomes = await agentConversation.waitForHumanOps(1)
          expect(
            outcomes.filter(({ outcome }) => outcome === 'rejected')
          ).toEqual([])
          await expect
            .poll(() => agentConversation.hostNodeIds())
            .toContain(added)
          return added
        })

      await test.step('edit the promoted prompt on the blueprint by hand', async () => {
        const field = agentConversation.vueNodes
          .getNodeLocator(hostId)
          .getByLabel(PROMOTED_WIDGET, { exact: true })
        await field.fill(EDITED_PROMPT)
        await field.blur()
        await agentConversation.waitForPendingFrames(
          PROMPT_NODE_ID,
          PROMPT_WIDGET,
          'blueprint edit judged'
        )
      })

      await test.step('no rejected-edit notice is shown', async () => {
        await expect
          .soft(
            comfyPage.toast.toastErrors.filter({
              hasText: enMessages.agent.editRejected.widgetWrite
            })
          )
          .toHaveCount(0)
      })

      await test.step('the edit reaches the shared document', async () => {
        await expect
          .poll(() => agentConversation.hostNode(hostId)?.widgets_values)
          .toEqual(expect.arrayContaining([EDITED_PROMPT]))
      })
    })
  }
)
