import { test as base } from '@playwright/test'

import { OnboardingCoachmarks } from '@e2e/fixtures/components/Tour'

export const onboardingFixture = base.extend<{
  onboarding: OnboardingCoachmarks
}>({
  onboarding: async ({ page }, use) => {
    await use(new OnboardingCoachmarks(page))
  }
})
