import { mergeTests } from '@playwright/test'

import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const CLOUD_REMOTE_CONFIG_MODULE =
  /\/(?:src\/extensions\/core\/cloudRemoteConfig\.ts|assets\/cloudRemoteConfig-[\w-]+\.js)(?:\?.*)?$/

interface InjectedCloudRemoteConfigModule {
  requests: number
}

const injectedCloudRemoteConfigModuleTest = base.extend<{
  injectedCloudRemoteConfigModule: InjectedCloudRemoteConfigModule
}>({
  injectedCloudRemoteConfigModule: [
    async ({ page }, use) => {
      const injected: InjectedCloudRemoteConfigModule = { requests: 0 }
      await page.route(CLOUD_REMOTE_CONFIG_MODULE, (route) => {
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

export const cloudRemoteConfigMissingExportTest = mergeTests(
  agentTest,
  injectedCloudRemoteConfigModuleTest
)
