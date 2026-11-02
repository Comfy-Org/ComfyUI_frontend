import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentConsentTest as test } from '@e2e/fixtures/agentConsentFixture'

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
      agentPanel,
      typeform
    }) => {
      await agentPanel.openFromClosed()
      await expect(agentPanel.consentLoadError).toContainText(
        enMessages.agent.consent.loadErrorTitle
      )

      await agentPanel.consentContactFormButton.click()

      await expect(typeform.root).toHaveAttribute(
        'data-tf-hidden',
        typeform.hiddenField('consent', 'check_failed')
      )
    })
  })

  test('names the page load, hold and composer state with no thread', async ({
    agentPanel,
    typeform
  }) => {
    await agentPanel.openFromClosed()
    await expect(agentPanel.consentDialog).toBeVisible()
    await agentPanel.consentRejectButton.click()
    await expect(agentPanel.consentDialog).toHaveCount(0)

    await agentPanel.openFromClosed()
    await agentPanel.consentAcceptButton.click()
    await expect(agentPanel.consentDialog).toHaveCount(0)
    await expect(agentPanel.root).toBeVisible()

    await agentPanel.feedbackButton.click()

    await expect(typeform.root).toHaveAttribute(
      'data-tf-hidden',
      typeform.hiddenField('consent', 'accepted')
    )
    await expect(typeform.root).toHaveAttribute(
      'data-tf-hidden',
      typeform.hiddenField('held', 'none')
    )
    await expect(typeform.root).toHaveAttribute(
      'data-tf-hidden',
      typeform.hiddenField('composer', 'idle')
    )
    await expect(typeform.root).toHaveAttribute(
      'data-tf-hidden',
      typeform.hiddenField(
        'client',
        '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
      )
    )
    await expect(typeform.root).not.toHaveAttribute(
      'data-tf-hidden',
      /(^|,)session=/
    )
  })
})
