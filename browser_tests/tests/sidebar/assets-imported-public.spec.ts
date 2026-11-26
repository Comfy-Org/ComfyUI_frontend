import { expect } from '@playwright/test'

import { createIncludePublicAssetsFixture } from '@e2e/fixtures/assetApiFixture'
import { createListedAsset } from '@e2e/fixtures/data/assetFixtures'

const test = createIncludePublicAssetsFixture(
  [
    createListedAsset('own-input', 'my_upload.png', ['input']),
    createListedAsset('own-output', 'my_render.png', ['output'])
  ],
  [
    createListedAsset('public-template-input-a', 'template_sample_a.png', [
      'input'
    ]),
    createListedAsset('public-template-input-b', 'template_sample_b.png', [
      'input'
    ]),
    createListedAsset('public-published-output', 'published_render.png', [
      'output'
    ])
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
