// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import type { WorkshopModel } from '../../config/models-catalogue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const model: WorkshopModel = {
  slug: 'flux',
  name: 'Flux',
  workflowCount: 2,
  href: '/models/flux/',
  routerId: 'bfl/flux',
  capabilities: [],
  provider: 'Black Forest Labs',
  modality: 'image',
  task: 'image-to-image',
  thumbnail: {
    url: 'https://assets.example/preview.mp4',
    kind: 'video'
  }
}

describe('WorkshopModelCard on the server', () => {
  it('leaves video thumbnails still until a client mounts the card', async () => {
    const html = await renderToString(
      createSSRApp({ render: () => h(WorkshopModelCard, { model }) })
    )

    expect(html).toContain('<video')
    expect(html).not.toContain('autoplay')
  })
})
