import type { operations } from '@/types/comfyRegistryTypes'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { mockDistributionsFlag } from '@e2e/fixtures/utils/platformFlagMocks'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']

/**
 * A signed-in local build fetches its workspace, billing and customer record
 * at boot, and `@auth` mocks none of them. The flag answer overrides the
 * shared default of `false`.
 */
export const deployToComfyApiTest = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const context = page.context()
    await mockWorkspace(context, workspace('personal', 'owner'), [])
    await mockBilling(page)
    await page.route('**/customers', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: 201,
            json: { id: 'test-user-e2e' } satisfies CreateCustomerResponse
          })
        : route.fallback()
    )
    await mockDistributionsFlag(context, true)
    await use(page)
  }
})
