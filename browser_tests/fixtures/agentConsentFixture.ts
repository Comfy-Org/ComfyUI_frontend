import { trackElementFlash } from '@e2e/fixtures/utils/flashDetector'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

export const agentConsentTest = agentTest.extend<{
  agentPanelFlash: Awaited<ReturnType<typeof trackElementFlash>>
}>({
  agentPanelFlash: [
    async ({ page }, use) => {
      await use(await trackElementFlash(page, 'docked-agent-panel'))
    },
    { auto: true }
  ]
})
