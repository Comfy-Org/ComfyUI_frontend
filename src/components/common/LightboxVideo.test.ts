import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { LightboxVideoItem } from '@/types/lightboxItem'

import LightboxVideo from './LightboxVideo.vue'

function setVhsAdvancedPreviews(enabled: boolean) {
  const extensionStore = useExtensionStore()
  vi.mocked(extensionStore.isExtensionInstalled).mockReturnValue(enabled)
  vi.mocked(extensionStore.isExtensionEnabled).mockReturnValue(enabled)
  vi.mocked(useSettingStore().get).mockImplementation((key) =>
    key === 'VHS.AdvancedPreviews' && enabled ? 'Always' : undefined
  )
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { videoFailedToLoad: 'Video failed to load' } } }
})

function renderSource(item: Omit<LightboxVideoItem, 'kind'>) {
  render(LightboxVideo, { props: item, global: { plugins: [i18n] } })
  return screen.getByTestId('lightbox-video-source')
}

const video = {
  url: '/api/view?filename=clip.mp4',
  mimeType: 'video/mp4',
  advancedPreviewUrl: '/api/viewvideo?filename=clip.mp4'
}

describe('LightboxVideo', () => {
  it.for([
    {
      vhs: true,
      item: video,
      src: video.advancedPreviewUrl,
      type: 'video/webm'
    },
    { vhs: false, item: video, src: video.url, type: 'video/mp4' },
    {
      vhs: true,
      item: { ...video, advancedPreviewUrl: undefined },
      src: video.url,
      type: 'video/mp4'
    }
  ])('plays $src when VHS previews are $vhs', ({ vhs, item, src, type }) => {
    setVhsAdvancedPreviews(vhs)

    const source = renderSource(item)

    expect(source.getAttribute('src')).toBe(src)
    expect(source.getAttribute('type')).toBe(type)
  })
})
