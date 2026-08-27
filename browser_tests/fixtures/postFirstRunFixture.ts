import { mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { FirstRunContinuation } from '@e2e/fixtures/components/FirstRunContinuation'
import { FirstRunNudge } from '@e2e/fixtures/components/FirstRunNudge'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { PostFirstRunHelper } from '@e2e/fixtures/helpers/PostFirstRunHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'
import { onboardingFixture } from '@e2e/fixtures/tourFixture'
import { webSocketFixture } from '@e2e/fixtures/ws'

const base = mergeTests(
  comfyPageFixture,
  onboardingFixture,
  templateApiFixture,
  webSocketFixture
)

export const postFirstRunFixture = base.extend<{
  firstRunContinuation: FirstRunContinuation
  firstRunNudge: FirstRunNudge
  postFirstRun: PostFirstRunHelper
}>({
  firstRunContinuation: async ({ page }, use) => {
    await use(new FirstRunContinuation(page))
  },
  firstRunNudge: async ({ page }, use) => {
    await use(new FirstRunNudge(page))
  },
  postFirstRun: async ({ comfyPage, getWebSocket, onboarding }, use) => {
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    await use(new PostFirstRunHelper(comfyPage, onboarding, execution))
  }
})
