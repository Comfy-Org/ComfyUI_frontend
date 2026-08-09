import { cloudAppFixture } from '@e2e/fixtures/cloudAppFixture'
import { BillingCheckoutStateMachineHelper } from '@e2e/fixtures/helpers/BillingCheckoutStateMachineHelper'

export const test = cloudAppFixture.extend<{
  billingCheckout: BillingCheckoutStateMachineHelper
}>({
  billingCheckout: async ({ page }, use, testInfo) => {
    const helper = new BillingCheckoutStateMachineHelper(page, testInfo)
    await helper.setup()
    await use(helper)
    await helper.attachEvidence()
  }
})

export { expect } from '@playwright/test'
