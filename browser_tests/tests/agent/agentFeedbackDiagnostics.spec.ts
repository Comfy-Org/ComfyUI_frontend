import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentConsentTest as test } from '@e2e/fixtures/agentConsentFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

/**
 * Typeform reads the hidden fields off `data-tf-hidden` on the embed container,
 * so stubbing its script keeps the container mounted and makes what the form
 * would receive observable without reaching the third party.
 */
async function stubTypeformEmbed(page: Page): Promise<void> {
  await page.route('https://embed.typeform.com/next/embed.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.tf = { load: () => {} }'
    })
  )
}

function hiddenFieldsOf(page: Page) {
  return page.getByTestId('typeform-embed')
}

async function openAgentFromClosed(page: Page): Promise<void> {
  const openButton = page.getByRole('button', {
    name: enMessages.agent.entryButton,
    exact: true
  })
  await expect(openButton).toBeVisible()
  if ((await openButton.getAttribute('aria-pressed')) === 'true')
    await new AgentPanel(page).close()
  await openButton.click()
}

test.describe('Agent feedback diagnostics', { tag: ['@cloud', '@ui'] }, () => {
  test.use({
    agentConsentAccepted: false,
    initialLocalStorage: {
      'Comfy.AgentConsent.IntroductionResponded.test-user-e2e.ws-personal':
        'true'
    }
  })

  test.describe('when the consent check fails', () => {
    test.use({ agentConsentLoadStatus: 500 })

    test('reports the failed check rather than one still running', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      await stubTypeformEmbed(page)
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })

      await openAgentFromClosed(page)
      await expect(dialog.getByRole('alert')).toContainText(
        enMessages.agent.consent.loadErrorTitle
      )

      await dialog
        .getByRole('button', { name: enMessages.agent.consent.contactForm })
        .click()

      // `unchecked` here would mean "the check never finished", which is the
      // state a report cannot be diagnosed from.
      await expect(hiddenFieldsOf(page)).toHaveAttribute(
        'data-tf-hidden',
        /(^|,)consent=check_failed(,|$)/
      )
    })
  })

  test('names the page load, hold and composer state with no thread', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await stubTypeformEmbed(page)
    const dialog = page.getByRole('dialog', {
      name: enMessages.agent.consent.title
    })

    await openAgentFromClosed(page)
    await expect(dialog).toBeVisible()
    await dialog
      .getByRole('button', { name: enMessages.agent.consent.reject })
      .click()
    await expect(dialog).toHaveCount(0)

    await openAgentFromClosed(page)
    await dialog
      .getByRole('button', { name: enMessages.agent.consent.accept })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('#agent-panel-root')).toBeVisible()

    await page
      .getByRole('button', { name: enMessages.agent.feedbackCaption })
      .click()

    const embed = hiddenFieldsOf(page)
    await expect(embed).toHaveAttribute(
      'data-tf-hidden',
      /(^|,)consent=accepted(,|$)/
    )
    await expect(embed).toHaveAttribute('data-tf-hidden', /(^|,)held=none(,|$)/)
    await expect(embed).toHaveAttribute(
      'data-tf-hidden',
      /(^|,)composer=idle(,|$)/
    )
    await expect(embed).toHaveAttribute(
      'data-tf-hidden',
      /(^|,)client=[0-9a-f-]{36}(,|$)/
    )
    await expect(embed).not.toHaveAttribute('data-tf-hidden', /(^|,)session=/)
  })
})
