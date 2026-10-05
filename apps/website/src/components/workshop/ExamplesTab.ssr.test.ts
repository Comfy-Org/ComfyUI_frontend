// @vitest-environment node
import { expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import ExamplesTab from './ExamplesTab.vue'

it('renders every video card on the server, loading nothing yet', async () => {
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h(ExamplesTab, {
          galleryLabel: 'Seedance',
          examples: ['a', 'b'].map((id) => ({
            id,
            title: id,
            specs: [],
            values: {},
            prompt: `prompt ${id}`,
            outputUrl: `https://assets.example/${id}.mp4`,
            mediaKind: 'video' as const
          }))
        })
    })
  )
  expect(html.match(/data-testid="example-card"/g)).toHaveLength(2)
  expect(html.match(/preload="none"/g)).toHaveLength(2)
})
