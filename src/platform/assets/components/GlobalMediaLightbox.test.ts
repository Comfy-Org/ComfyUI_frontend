import { fromPartial } from '@total-typescript/shoehorn'

import { render, screen } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import GlobalMediaLightbox from '@/platform/assets/components/GlobalMediaLightbox.vue'
import { useMediaAssetGalleryStore } from '@/platform/assets/composables/useMediaAssetGalleryStore'
import type { AugmentedResultItem } from '@/utils/resultItem'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        gallery: 'Gallery',
        close: 'Close',
        previous: 'Previous',
        next: 'Next'
      }
    }
  }
})

function renderGlobalMediaLightbox() {
  return render(GlobalMediaLightbox, {
    global: { plugins: [getActivePinia()!, i18n] }
  })
}

const item = fromPartial<AugmentedResultItem>({
  filename: 'a.png',
  mediaType: 'images',
  url: '/api/view?filename=a.png'
})

describe('GlobalMediaLightbox', () => {
  it('renders nothing until the gallery store opens something', () => {
    renderGlobalMediaLightbox()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the lightbox when the store opens an item', async () => {
    renderGlobalMediaLightbox()
    const galleryStore = useMediaAssetGalleryStore()

    galleryStore.openItems([item], 0)
    await nextTick()

    expect(screen.getByRole('dialog', { name: 'Gallery' })).toBeInTheDocument()
  })

  // The store outlives this renderer, so an open gallery would otherwise
  // reappear the next time a graph view mounts.
  it('closes the gallery when it is torn down', async () => {
    const { unmount } = renderGlobalMediaLightbox()
    const galleryStore = useMediaAssetGalleryStore()
    galleryStore.openItems([item], 0)
    await nextTick()

    unmount()

    expect(galleryStore.activeIndex).toBe(-1)
  })
})
