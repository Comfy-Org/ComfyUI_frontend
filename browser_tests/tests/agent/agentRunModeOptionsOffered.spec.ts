import { expect, mergeTests } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

import type { AgentRunModePreference } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

// Backfills the browser cover that
// https://github.com/Comfy-Org/ComfyUI_frontend/pull/17220 deliberately did not
// add ("No new E2E test: availability is owned by this component and covered
// directly"). What that component test cannot see is the rendered picker: the
// options array, the trigger/tooltip label maps and the credit-limit input are
// three separate places that still know about `auto_limited`, so re-exposing it
// is a six-line edit in one of them. If it comes back, a V1 user can select a
// run mode whose credit limit the product does not offer.
const test = mergeTests(agentTest, webSocketFixture)

test.describe(
  'Agent run permissions options offered',
  { tag: '@cloud' },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('offers exactly the two supported modes and no credit limit', async ({
      agentPanel,
      comfyPage
    }) => {
      const page = comfyPage.page

      // Pin the saved preference so the picker's contents are the only variable.
      // Without this the popover could render a third option merely because the
      // server echoed a stored `auto_limited`.
      await page.route('**/api/agent/run-mode', (route) =>
        route.fulfill(
          jsonRoute({
            mode: 'ask_approval',
            credit_limit: null
          } satisfies AgentRunModePreference)
        )
      )

      await agentPanel.open()
      await agentPanel.selectWorkflow()
      const panel = agentPanel.root

      // Portalled, so the options are addressed from the page, not the panel.
      const popoverHeading = page.getByText(enMessages.agent.runPermissions, {
        exact: true
      })
      const options = page.getByRole('menuitemradio')

      await test.step('the picker opens', async () => {
        await panel
          .getByRole('button', {
            name: enMessages.agent.runModeTriggerAsk,
            exact: true
          })
          .click()
        await expect(popoverHeading).toBeVisible()
      })

      await test.step('both supported modes are offered', async () => {
        // Asserted before the count, so a failure says which mode is missing
        // rather than only that the total moved.
        await expect(
          page.getByRole('menuitemradio', {
            name: new RegExp(enMessages.agent.runModeAsk)
          })
        ).toBeVisible()
        await expect(
          page.getByRole('menuitemradio', {
            name: new RegExp(enMessages.agent.runModeAuto)
          })
        ).toBeVisible()
      })

      await test.step('the limited mode is not offered', async () => {
        await expect(
          page.getByRole('menuitemradio', {
            name: new RegExp(enMessages.agent.runModeLimit)
          })
        ).toHaveCount(0)
        await expect(
          page.getByText(enMessages.agent.runModeLimitDescription)
        ).toHaveCount(0)
        // The nested credit-limit input rides along with that option, so it is
        // asserted separately: a build that kept the input but relabelled the
        // option would still fail here.
        await expect(page.getByRole('spinbutton')).toHaveCount(0)
        await expect(options).toHaveCount(2)
      })
    })
  }
)
