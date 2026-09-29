import type { operations } from '@/types/comfyRegistryTypes'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockDistributionsFlag } from '@e2e/fixtures/utils/platformFlagMocks'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']

/**
 * A signed-in local build fetches its workspace, billing and customer record
 * at boot, and `@auth` mocks none of them. The flag answer overrides the
 * shared default of `false`.
 */
export const deployToComfyApiTest = comfyPageFixture.extend<{
  platformFlag: { readonly asked: number }
}>({
  platformFlag: async ({ context }, use) => {
    await use(await mockDistributionsFlag(context, true))
  },
  page: async ({ page, platformFlag: _installedBeforeBoot }, use) => {
    const context = page.context()
    await mockWorkspace(context, workspace('personal', 'owner'), [])
    await mockBilling(page)
    await page.route(
      'https://media.comfy.org/website/comfy-api/**',
      (route) => {
        const url = route.request().url()
        if (url.endsWith('.webm')) {
          return route.fulfill({
            path: assetPath('video/video-preview-wide.webm')
          })
        }
        if (url.endsWith('.mp4')) {
          return route.fulfill({ path: assetPath('plain_video.mp4') })
        }
        return route.fulfill({ path: assetPath('image64x64.webp') })
      }
    )
    await page.route('**/customers', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: 201,
            json: { id: 'test-user-e2e' } satisfies CreateCustomerResponse
          })
        : route.fallback()
    )
    await use(page)
  }
})
