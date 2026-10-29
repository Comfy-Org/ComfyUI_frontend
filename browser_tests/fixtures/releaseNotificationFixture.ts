import type { components } from '@comfyorg/registry-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

type ReleaseResponse =
  | { status: 200; body: components['schemas']['ReleaseNote'][] }
  | { status: 500; body: components['schemas']['ErrorResponse'] }

export const releaseNotificationFixture = comfyPageFixture.extend<{
  releaseResponse: ReleaseResponse
  releaseRequests: string[]
}>({
  mockReleases: false,
  releaseResponse: [{ status: 200, body: [] }, { option: true }],
  releaseRequests: [
    async ({ page, releaseResponse }, use) => {
      const requests: string[] = []
      await page.route('**/releases**', async (route) => {
        const url = route.request().url()
        if (
          url.includes('api.comfy.org') ||
          url.includes('stagingapi.comfy.org')
        ) {
          requests.push(url)
          await route.fulfill({
            status: releaseResponse.status,
            json: releaseResponse.body
          })
        } else {
          await route.fallback()
        }
      })
      await use(requests)
    },
    { auto: true }
  ]
})
