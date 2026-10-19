import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

import WorkshopCardMedia from './WorkshopCardMedia.vue'

describe('Hub browsing thumbnails', () => {
  it.for(['image', 'video'] as const)(
    'loads only the still thumbnail for %s cards',
    async (kind) => {
      const html = await renderToString(
        createSSRApp(WorkshopCardMedia, {
          model: {
            name: 'Card',
            thumbnail: {
              url: '/original/full-resolution',
              kind,
              poster: '/preview-media/7/thumb/exact-version',
              staticUrl: '/preview-media/7/thumb/exact-version'
            }
          }
        })
      )
      expect(html).toContain('<img')
      expect(html).toContain('src="/preview-media/7/thumb/exact-version"')
      expect(html).not.toContain('<video')
      expect(html).not.toContain('/original/full-resolution')
    }
  )
  it('shows the placeholder instead of an image for an audio card with no still', async () => {
    const html = await renderToString(
      createSSRApp(WorkshopCardMedia, {
        model: {
          name: 'Card',
          thumbnail: { url: '/catalog-media/hero/song', kind: 'audio' }
        }
      })
    )
    expect(html).not.toContain('/catalog-media/hero/song')
    expect(html).toContain('data-testid="model-media-placeholder"')
  })
})
