import type { Page } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import { zAgentAdmissionError } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

// Backfill for https://github.com/Comfy-Org/ComfyUI_frontend/pull/17532
// (fix(agent): honour Retry-After for funds_unavailable admission denials,
// https://linear.app/comfyorg/issue/FE-2005). `no_funds` already has browser
// cover in `agentPanel.spec.ts`; the two reasons that PR actually separated had
// none, so a change that collapsed them back into one treatment would ship.
//
// Parsed through the generated admission contract, like the `no_funds` fixture
// it sits next to, so a server-side rename of a `reason` or `type` breaks these
// fixtures instead of silently passing.
const FUNDS_UNAVAILABLE_ERROR = zAgentAdmissionError.parse({
  error: {
    message: 'Billing is temporarily unavailable.',
    reason: 'funds_unavailable',
    type: 'SERVICE_UNAVAILABLE'
  }
})

const MANUAL_BLOCK_ERROR = zAgentAdmissionError.parse({
  error: {
    message: 'This account cannot run the agent.',
    reason: 'manual_block',
    type: 'PAYMENT_REQUIRED'
  }
})

const RETRY_AFTER_SECONDS = 45

test.describe('In-App Agent admission denials', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  /**
   * Rejects the next turn POST with `body`, always sending a `Retry-After`
   * header. The header is deliberately present for both reasons: the branch
   * under test is the `reason`, not the header, so a `manual_block` that starts
   * rendering the hint is a real regression rather than a missing fixture.
   */
  async function rejectNextTurn(
    page: Page,
    status: number,
    body: unknown
  ): Promise<void> {
    // Scoped to POST so the fixture's GET handler for the same URL still serves
    // the thread's message history.
    await page.route('**/api/agent/threads/*/messages', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      await route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'Retry-After': String(RETRY_AFTER_SECONDS) },
        body: JSON.stringify(body)
      })
    })
  }

  test('tells the user when to retry a transient funds_unavailable denial', async ({
    agentPanel,
    comfyPage
  }) => {
    const panel = agentPanel.root
    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    const prompt = 'Upscale the hero shot'

    await test.step('reject the next turn with a funds_unavailable denial', async () => {
      await rejectNextTurn(comfyPage.page, 503, FUNDS_UNAVAILABLE_ERROR)
    })

    await test.step('open the agent panel on a workflow', async () => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
    })

    await test.step('send a prompt the server will reject', async () => {
      await composer.fill(prompt)
      await panel.getByRole('button', { name: 'Send' }).click()
    })

    await test.step('surface the denial with a retry hint', async () => {
      const notice = panel.getByRole('alert')
      await expect(notice).toContainText('Billing is temporarily unavailable.')
      await expect(notice).toContainText(
        `You can try again in ${RETRY_AFTER_SECONDS}s.`
      )
    })

    await test.step('keep the rejected prompt recoverable', async () => {
      await expect(panel.getByTestId('user-message-bubble')).toHaveText(prompt)
      await expect(composer).toHaveText(prompt)
    })
  })

  test('does not invite a retry on a deliberate manual_block denial', async ({
    agentPanel,
    comfyPage
  }) => {
    const panel = agentPanel.root
    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    const prompt = 'Upscale the hero shot'

    await test.step('reject the next turn with a manual_block denial', async () => {
      await rejectNextTurn(comfyPage.page, 402, MANUAL_BLOCK_ERROR)
    })

    await test.step('open the agent panel on a workflow', async () => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
    })

    await test.step('send a prompt the server will reject', async () => {
      await composer.fill(prompt)
      await panel.getByRole('button', { name: 'Send' }).click()
    })

    await test.step('surface the denial without a retry hint', async () => {
      const notice = panel.getByRole('alert')
      await expect(notice).toContainText('This account cannot run the agent.')
      // A non-retryable 402 must not tell the user to wait and try again, even
      // though the response carried a `Retry-After` header.
      await expect(notice).not.toContainText('You can try again in')
    })
  })
})
