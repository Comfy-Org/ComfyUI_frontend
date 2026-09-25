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

      // Preconditions stay ABOVE the marker so they read as real failures
      // rather than the expected one: body-level test.fail() only sets the
      // expected status once it executes. Undo itself works — the local edit
      // reverts to 20 — and that is what makes the defect below meaningful. If
      // this line ever fails, undo stopped applying at all, which is a
      // different defect and must not be classified as this one.
      await expect(steps).toHaveValue('20')

      // resyncWidget also stays above the marker: it drives the remote
      // document, and a throw inside it would otherwise read as the expected
      // failure without the assertion ever running.
      await agentConversation.resyncWidget(KSAMPLER_NODE_ID, 'steps')

      // The remote document still holds 30, so settling it overwrites the
      // undone local value instead of preserving it. This single assertion is
      // the only thing this test's outcome should hinge on.
      test.fail(
        true,
        'Undo does not survive the remote document state; this pins the live defect.'
      )
      await expect(steps).toHaveValue('20')
    })
  }
)
