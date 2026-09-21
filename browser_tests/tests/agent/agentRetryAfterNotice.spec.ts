import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { zAgentAdmissionError } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

// Regression e2e coverage for FE-2461: a `Retry-After` value the RFC 9110
// grammar does not allow must not become a retry hint. `Date.parse` accepts an
// ISO-8601 timestamp, so a server sending `2099-12-31T00:00:00` used to make
// the panel promise the user a retry roughly 73 years out. The unit tests pin
// the parser's contract directly; this file proves what the user sees, since
// the delay only reaches the screen through the whole admission path.

const FUNDS_UNAVAILABLE = zAgentAdmissionError.parse({
  error: {
    message: 'Billing status is temporarily unavailable; please retry.',
    reason: 'funds_unavailable',
    type: 'SERVICE_UNAVAILABLE'
  }
})

/** `You can try again in ` - the retry line with its count stripped off. */
const RETRY_LINE_PREFIX =
  enMessages.agent.retryAfterSeconds.split('{seconds}')[0]

function retryLine(seconds: number): string {
  return enMessages.agent.retryAfterSeconds.replace(
    '{seconds}',
    String(seconds)
  )
}

/** The next turn POST is refused with `Retry-After: <header>`. */
async function mockRetryAfterOnNextTurn(
  page: Page,
  header: string
): Promise<void> {
  await page.route('**/api/agent/threads/*/messages', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({
      status: 503,
      headers: {
        'content-type': 'application/json',
        'retry-after': header
      },
      body: JSON.stringify(FUNDS_UNAVAILABLE)
    })
  })
}

async function sendTurnRefusedWith(page: Page, header: string) {
  const panel = page.locator('#agent-panel-root')
  await panel
    .getByRole('button', { name: enMessages.agent.switchWorkflow })
    .click()
  await page
    .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
    .click()

  await mockRetryAfterOnNextTurn(page, header)

  await panel
    .getByRole('textbox', { name: /^Describe ideas/ })
    .fill('Make a red fox in the snow')
  await panel.getByRole('button', { name: enMessages.agent.send }).click()

  await expect(panel.getByText(FUNDS_UNAVAILABLE.error.message)).toBeVisible()
  return panel
}

agentTest.describe(
  'Agent Retry-After notice',
  { tag: ['@cloud', '@ui'] },
  () => {
    agentTest(
      'shows the retry delay a delay-seconds header names',
      async ({ page, agentPanel }) => {
        await agentPanel.open()
        const panel = await sendTurnRefusedWith(page, '30')

        await expect(panel.getByText(retryLine(30))).toBeVisible()
      }
    )

    agentTest(
      'offers no retry delay for a Retry-After that is not an HTTP-date',
      async ({ page, agentPanel }, testInfo) => {
        await agentPanel.open()
        const panel = await sendTurnRefusedWith(page, '2099-12-31T00:00:00')

        await expect(panel.getByText(RETRY_LINE_PREFIX)).toHaveCount(0)

        await testInfo.attach('agent-notice-without-retry-line', {
          body: await panel.screenshot({ animations: 'disabled' }),
          contentType: 'image/png'
        })
      }
    )
  }
)
