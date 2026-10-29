import { expect } from '@playwright/test'

import type { Asset } from '@comfyorg/ingest-types'
import { createIncludePublicAssetsFixture } from '@e2e/fixtures/assetApiFixture'

const createdAt = new Date().toISOString()

function makeAsset(id: string, name: string, tags: string[]): Asset {
  return {
    id,
    name,
    tags,
    preview_url: `/api/view?filename=${name}&type=input`,
    created_at: createdAt,
    updated_at: createdAt
  }
}

const test = createIncludePublicAssetsFixture(
  [
    makeAsset('own-input', 'my_upload.png', ['input']),
    makeAsset('own-output', 'my_render.png', ['output'])
  ],
  [
    makeAsset('public-template-input-a', 'template_sample_a.png', ['input']),
    makeAsset('public-template-input-b', 'template_sample_b.png', ['input']),
    makeAsset('public-published-output', 'published_render.png', ['output'])
  ]
)

test.describe(
  'Assets sidebar - public assets stay out of the panel',
  { tag: '@cloud' },
  () => {
    test('Imported tab lists only the user’s own inputs', async ({
      comfyPage,
      includePublicValues
    }) => {
      const tab = comfyPage.menu.assetsTab
      await tab.open()
      await tab.switchToImported()

      await expect(tab.getAssetCardByName('my_upload')).toBeVisible()
      await expect(tab.getAssetCardByName('template_sample_a')).toHaveCount(0)
      await expect(tab.getAssetCardByName('template_sample_b')).toHaveCount(0)
      await expect(tab.assetCards).toHaveCount(1)

      const sent = includePublicValues('input')
      expect(sent).toContain('false')
      expect(sent).not.toContain(null)
      expect(sent).not.toContain('true')
    })

    test('Generated tab omits published assets of other users', async ({
      comfyPage,
      includePublicValues
    }) => {
      const tab = comfyPage.menu.assetsTab
      await tab.open()

      await expect(tab.getAssetCardByName('my_render')).toBeVisible()
      await expect(tab.getAssetCardByName('published_render')).toHaveCount(0)

      const sent = includePublicValues('output')
      expect(sent).toContain('false')
      expect(sent).not.toContain(null)
      expect(sent).not.toContain('true')
    })
  }
)
