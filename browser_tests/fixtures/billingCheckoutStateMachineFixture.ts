import { cloudAppFixture } from '@e2e/fixtures/cloudAppFixture'
import { BillingCheckoutStateMachineHelper } from '@e2e/fixtures/helpers/BillingCheckoutStateMachineHelper'

export const billingCheckoutStateMachineFixture = cloudAppFixture.extend<{
  billingCheckout: BillingCheckoutStateMachineHelper
}>({
  billingCheckout: async ({ page }, use) => {
    const billingCheckout = new BillingCheckoutStateMachineHelper(page)
    await billingCheckout.boot()
    await use(billingCheckout)
  }
})

export { cloudAppExpect as billingCheckoutExpect } from '@e2e/fixtures/cloudAppFixture'
