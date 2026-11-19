import { AccessibilityHelper } from '@e2e/fixtures/helpers/AccessibilityHelper'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

export const accessibilityFixture = base.extend<{
  accessibility: AccessibilityHelper
}>({
  accessibility: async ({ page }, use, testInfo) => {
    await use(new AccessibilityHelper(page, testInfo))
  }
})
