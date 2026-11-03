import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const AGENT_PANEL_MODULE =
  /\/(?:src\/extensions\/core\/agentPanel\.ts|assets\/agentPanel-[\w-]+\.js)(?:\?.*)?$/

interface InjectedAgentPanelModule {
  requests: number
}

export const agentPanelMissingExportTest = agentTest.extend<{
  injectedAgentPanelModule: InjectedAgentPanelModule
}>({
  injectedAgentPanelModule: [
    async ({ page }, use) => {
      const injected: InjectedAgentPanelModule = { requests: 0 }
      await page.route(AGENT_PANEL_MODULE, (route) => {
        injected.requests++
        return route.fulfill({
          contentType: 'text/javascript',
          body: 'export {}'
        })
      })
      await use(injected)
    },
    { auto: true }
  ]
})
