import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const WIDGET_CASE = 'agent-rec-set-widget-existing'
const KSAMPLER_NODE_ID = '3'

test.describe(
  'Agent remote edit undo',
  { tag: ['@cloud', '@agent', '@canvas', '@widget', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: WIDGET_CASE })

    test('keeps an undone agent widget edit after the document settles', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)

      const steps = agentConversation.vueNodes
        .getNodeLocator(KSAMPLER_NODE_ID)
        .getByLabel('steps', { exact: true })
        .getByRole('spinbutton')

      await agentConversation.runTurns()
      await expect(steps).toHaveValue('30')

      const sampler =
        await agentConversation.vueNodes.getFixtureByTitle('KSampler')
      await sampler.title.click()
      await page.keyboard.press('ControlOrMeta+z')

      await expect(steps).toHaveValue('20')

      await agentConversation.resyncWidget(KSAMPLER_NODE_ID, 'steps')

      test.fail(
        true,
        'Undo does not survive the remote document state; this pins the live defect.'
      )
      await expect(steps).toHaveValue('20')
    })
  }
)
