import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

import QueueThumb from './QueueThumb.vue'

describe('publish-row thumbnails', () => {
  it('loads a resolved still image', async () => {
    const html = await renderToString(
      createSSRApp(QueueThumb, {
        src: '/preview-media/7/thumb/exact-version',
        mediaKind: 'image'
      })
    )
    expect(html).toContain('<img')
    expect(html).toContain('src="/preview-media/7/thumb/exact-version"')
    expect(html).not.toContain('<video')
  })

  it('never mounts a video to obtain a thumbnail, including extensionless media', async () => {
    for (const src of [
      '/preview-media/7/original/exact-version',
      '/full.mp4'
    ]) {
      const html = await renderToString(
        createSSRApp(QueueThumb, { src, mediaKind: 'video' })
      )
      expect(html).not.toContain('<video')
      expect(html).not.toContain('<img')
      expect(html).not.toContain(src)
    }
  })
})
