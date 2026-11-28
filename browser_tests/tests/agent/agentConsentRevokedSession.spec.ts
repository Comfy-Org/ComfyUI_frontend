import { expect } from '@playwright/test'
import type { ConsoleMessage } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { REPORTED_ERROR_PREFIX } from '@comfyorg/shared-frontend-utils/telemetry'

import { agentConsentTest } from '@e2e/fixtures/agentConsentFixture'

const CONSENT_LOAD_REPORT = `${REPORTED_ERROR_PREFIX}agent_consent_setting_load_failure`

const test = agentConsentTest.extend<{ consentLoadReports: ConsoleMessage[] }>({
  consentLoadReports: async ({ page }, use) => {
    const reports: ConsoleMessage[] = []
    page.on('console', (message) => {
      if (message.text().startsWith(CONSENT_LOAD_REPORT)) reports.push(message)
    })
    await use(reports)
  }
})

test.describe(
  'Agent consent on a session the server revoked',
  {
    tag: ['@cloud', '@agent'],
    annotation: {
      type: 'source',
      description: 'https://comfy-org.sentry.io/issues/7790947498/'
    }
  },
  () => {
    test.use({
      agentConsentAccepted: false,
      agentConsentLoadStatus: 401,
      initialLocalStorage: {
        'Comfy.AgentConsent.IntroductionResponded.test-user-e2e.ws-personal':
          'true'
      }
    })

    test.describe('when ingest names the revocation', () => {
      test.use({ agentConsentLoadRefusalCode: 'session_revoked' })

      test('reports the refused read as a warning and still offers the card', async ({
        agentPanel,
        consentLoadReports
      }) => {
        await agentPanel.openFromClosed()
        await expect(agentPanel.consentLoadError).toContainText(
          enMessages.agent.consent.loadErrorTitle
        )

        await expect.poll(() => consentLoadReports.length).toBeGreaterThan(0)
        expect(consentLoadReports.map((report) => report.type())).not.toContain(
          'error'
        )
      })
    })

    test.describe('when the refusal is not a revocation', () => {
      test.use({ agentConsentLoadRefusalCode: 'no_session' })

      test('still reports the refused read at error level', async ({
        agentPanel,
        consentLoadReports
      }) => {
        await agentPanel.openFromClosed()
        await expect(agentPanel.consentLoadError).toContainText(
          enMessages.agent.consent.loadErrorTitle
        )

        await expect
          .poll(() => consentLoadReports.map((report) => report.type()))
          .toContain('error')
      })
    })
  }
)
