import { expect } from '@playwright/test'
import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const contractTest = test.extend<{ assetApiRequests: URL[] }>({
  assetApiRequests: async ({ page }, use) => {
    const requests: URL[] = []
    const outputAsset = {
      id: 'output-asset',
      name: 'enabled-output.png',
      size: 1024,
      mime_type: 'image/png',
      tags: ['output'],
      preview_url: '/api/view?filename=enabled-output.png&type=output',
      created_at: '2026-08-29T00:00:00.000Z',
      updated_at: '2026-08-29T00:00:00.000Z'
    } satisfies Asset
    const inputAsset = {
      id: 'input-asset',
      name: 'enabled-input.png',
      size: 1024,
      mime_type: 'image/png',
      tags: ['input'],
      preview_url: '/api/view?filename=enabled-input.png&type=input',
      created_at: '2026-08-29T00:00:00.000Z',
      updated_at: '2026-08-29T00:00:00.000Z'
    } satisfies Asset

    await page.route(/\/api\/assets(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url())
      requests.push(url)
      const assets =
        url.searchParams.get('tags_any') === 'input'
          ? [inputAsset]
          : [outputAsset]
      const response = {
        assets,
        total: assets.length,
        has_more: false
      } satisfies ListAssetsResponse
      await route.fulfill({ json: response })
    })
    await use(requests)
  }
})

const assertSharedQueryContract = (requests: URL[]) => {
  const outputRequest = requests.find((url) =>
    url.searchParams.get('tags_any')?.includes('output')
  )
  const inputRequest = requests.find(
    (url) => url.searchParams.get('tags_any') === 'input'
  )
  expect(outputRequest?.searchParams.get('tags_any')).toBe('output,temp')
  expect(outputRequest?.searchParams.get('tags_none')).toBe('missing')
  expect(inputRequest?.searchParams.get('tags_any')).toBe('input')
  expect(inputRequest?.searchParams.get('tags_none')).toBe('missing')
}

contractTest.describe(
  'Assets sidebar Asset API contract',
  { tag: '@oss' },
  () => {
    contractTest(
      'uses the shared query contract when enabled on OSS',
      async ({ assetApiRequests, comfyPage }) => {
        await comfyPage.featureFlags.setServerFlagsPersistent({ assets: true })
        const tab = comfyPage.menu.assetsTab
        await tab.open()
        await expect(tab.getAssetCardByName('enabled-output')).toBeVisible()
        await tab.switchToImported()
        await expect(tab.getAssetCardByName('enabled-input')).toBeVisible()

        assertSharedQueryContract(assetApiRequests)
      }
    )
  }
)

contractTest.describe(
  'Assets sidebar Asset API contract on Cloud',
  { tag: '@cloud' },
  () => {
    contractTest(
      'uses the shared query contract',
      async ({ assetApiRequests, comfyPage }) => {
        const tab = comfyPage.menu.assetsTab
        await tab.open()
        await expect(tab.getAssetCardByName('enabled-output')).toBeVisible()
        await tab.switchToImported()
        await expect(tab.getAssetCardByName('enabled-input')).toBeVisible()

        assertSharedQueryContract(assetApiRequests)
      }
    )
  }
)
