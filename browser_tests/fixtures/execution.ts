import { mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { BackendSimulator } from '@e2e/fixtures/helpers/BackendSimulator'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const base = mergeTests(comfyPageFixture, webSocketFixture)

export const executionFixture = base.extend<{
  execution: ExecutionHelper
  backendSimulator: BackendSimulator
}>({
  execution: async ({ comfyPage, getWebSocket }, use) => {
    await use(new ExecutionHelper(comfyPage, await getWebSocket()))
  },
  backendSimulator: async ({ execution }, use) => {
    await use(new BackendSimulator(execution))
  }
})
