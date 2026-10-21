import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

test.describe(
  'Promoted widget edit on a human-added subgraph blueprint with Agent bound',
  { tag: ['@cloud', '@agent', '@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      humanOpsHost: 'apply'
    })

    test('saves the edit to the shared document without a rejection notice', async ({
      agentConversation,
      comfyPage
    }) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn', () =>
        agentConversation.runTurns())

      const hostId =
        await test.step('add a blueprint that promotes its prompt', async () => {
          const added = await agentConversation.addBlueprint(true, [400, 400])
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
          .getByLabel('text', { exact: true })
        await field.fill('an edited blueprint prompt')
        await field.blur()
        await agentConversation.waitForPendingFrames(
          '6',
          'text',
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
          .toEqual(expect.arrayContaining(['an edited blueprint prompt']))
      })
    })
  }
)
