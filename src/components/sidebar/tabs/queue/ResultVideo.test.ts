import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { AugmentedResultItem } from '@/utils/resultItem'

import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useSettingStore } from '@/platform/settings/settingStore'

import ResultVideo from './ResultVideo.vue'

const distribution = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => distribution)

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

function renderVideo(result: AugmentedResultItem) {
  render(ResultVideo, {
    props: { result },
    global: { plugins: [i18n] }
  })
  return screen.getByTestId('result-video-source')
}

const jobOutput: AugmentedResultItem = {
  filename: 'clip_00001_.mp4',
  subfolder: '',
  type: 'output',
  nodeId: '3',
  mediaType: 'video'
}

const assetItem: AugmentedResultItem = {
  ...jobOutput,
  filename: 'QATEST_c45_00002_.mp4',
  url: '/api/view?filename=blake3%3Aabc&type=output'
}

describe('ResultVideo', () => {
  beforeEach(() => {
    distribution.isCloud = false
    setVhsAdvancedPreviews(false)
  })

  it('plays the resolved url of an item that carries one', () => {
    expect(renderVideo(assetItem).getAttribute('src')).toBe(assetItem.url)
  })

  it('plays the resolved url on Cloud with VHS advanced previews on', () => {
    distribution.isCloud = true
    setVhsAdvancedPreviews(true)

    const source = renderVideo(assetItem)

    expect(source.getAttribute('src')).toBe(assetItem.url)
    expect(source.getAttribute('type')).toBe('video/mp4')
  })

  it('falls back to the VHS preview on Cloud when the url is empty', () => {
    distribution.isCloud = true
    setVhsAdvancedPreviews(true)

    expect(renderVideo({ ...assetItem, url: '' }).getAttribute('src')).toMatch(
      /^\/api\/viewvideo\?/
    )
  })

  it('keeps the VHS preview off Cloud, where the filename is on disk', () => {
    setVhsAdvancedPreviews(true)

    expect(renderVideo(assetItem).getAttribute('src')).toMatch(
      /^\/api\/viewvideo\?filename=QATEST_c45_00002_\.mp4&/
    )
  })

  it('uses the VHS advanced preview for a job output without a url', () => {
    distribution.isCloud = true
    setVhsAdvancedPreviews(true)

    const source = renderVideo(jobOutput)

    expect(source.getAttribute('src')).toMatch(
      /^\/api\/viewvideo\?filename=clip_00001_\.mp4&/
    )
    expect(source.getAttribute('type')).toBe('video/webm')
  })

  it('uses /view for a job output when VHS advanced previews are off', () => {
    expect(renderVideo(jobOutput).getAttribute('src')).toMatch(
      /^\/api\/view\?filename=clip_00001_\.mp4&/
    )
  })
})
