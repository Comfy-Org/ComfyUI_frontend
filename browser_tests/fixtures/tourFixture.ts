import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

import { OnboardingCoachmarks } from '@e2e/fixtures/components/Tour'

export const onboardingFixture = base.extend<{
  onboarding: OnboardingCoachmarks
}>({
  onboarding: async ({ page }, use) => {
    await use(new OnboardingCoachmarks(page))
  }
})
