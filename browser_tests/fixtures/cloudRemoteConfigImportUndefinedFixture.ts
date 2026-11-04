import { mergeTests } from '@playwright/test'

import { REPORTED_ERROR_PREFIX } from '@comfyorg/shared-frontend-utils/telemetry'

import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const CLOUD_REMOTE_CONFIG_CHUNK =
  /\/assets\/cloudRemoteConfig-[\w-]+\.js(?:\?.*)?$/

const REMOTE_CONFIG_REPORT = `${REPORTED_ERROR_PREFIX}error_loading_cloud_remote_config_extension`

interface FailedCloudRemoteConfigImport {
  requests: number
  reports: string[]
}

const failedCloudRemoteConfigImportTest = base.extend<{
  failedCloudRemoteConfigImport: FailedCloudRemoteConfigImport
}>({
  failedCloudRemoteConfigImport: [
    async ({ page }, use) => {
      const failure: FailedCloudRemoteConfigImport = {
        requests: 0,
        reports: []
      }
      page.on('console', (message) => {
        if (message.type() !== 'error') return
        const text = message.text()
        if (text.startsWith(REMOTE_CONFIG_REPORT)) failure.reports.push(text)
      })
      await page.route(CLOUD_REMOTE_CONFIG_CHUNK, (route) => {
        failure.requests++
        return route.fulfill({ status: 404, body: 'Not Found' })
      })
      await use(failure)
    },
    { auto: true }
  ]
})

export const cloudRemoteConfigImportUndefinedTest = mergeTests(
  agentTest,
  failedCloudRemoteConfigImportTest
)
