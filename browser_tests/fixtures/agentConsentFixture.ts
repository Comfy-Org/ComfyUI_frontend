import { TypeformEmbed } from '@e2e/fixtures/components/TypeformEmbed'
import { trackElementFlash } from '@e2e/fixtures/utils/flashDetector'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

export const agentConsentTest = agentTest.extend<{
  agentPanelFlash: Awaited<ReturnType<typeof trackElementFlash>>
  typeform: TypeformEmbed
}>({
  agentPanelFlash: [
    async ({ page }, use) => {
      await use(await trackElementFlash(page, 'docked-agent-panel'))
    },
    { auto: true }
  ],
  typeform: async ({ page }, use) => {
    const typeform = new TypeformEmbed(page)
    await typeform.stubScript()
    await use(typeform)
  }
})
