import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import AssetHoverPreview from './AssetHoverPreview.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

// An empty `tags` array yields no model type, so the node-preview section stays
// hidden — keeping the component free of the model-to-node store and the heavy
// NodePreview render for these presentational assertions.
const baseAsset: AssetItem = {
  id: 'asset-1',
  name: 'mymodel.safetensors',
  tags: []
}

function renderPreview(asset: AssetItem) {
  return render(AssetHoverPreview, {
    global: {
      plugins: [i18n],
      directives: { tooltip: {} }
    },
    props: { asset }
  })
}

describe('AssetHoverPreview', () => {
  it('shows the description section when a description is present', () => {
    renderPreview({
      ...baseAsset,
      user_metadata: { user_description: 'A cutting-edge model.' }
    })
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('A cutting-edge model.')).toBeInTheDocument()
  })

  it('hides the description section when the description is empty', () => {
    renderPreview({ ...baseAsset, user_metadata: { user_description: '' } })
    expect(screen.queryByText('Description')).toBeNull()
  })

  it('renders trigger words as chips under a labelled section', () => {
    renderPreview({
      ...baseAsset,
      metadata: { trained_words: ['cat', 'digital art'] }
    })
    expect(screen.getByText('Trigger words')).toBeInTheDocument()
    expect(screen.getByText('cat')).toBeInTheDocument()
    expect(screen.getByText('digital art')).toBeInTheDocument()
  })

  it('omits the trigger words section when there are none', () => {
    renderPreview(baseAsset)
    expect(screen.queryByText('Trigger words')).toBeNull()
  })
})
