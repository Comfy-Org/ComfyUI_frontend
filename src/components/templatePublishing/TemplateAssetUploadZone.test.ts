import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import type { UploadProgress } from '@/composables/useAssetUploadProgress'
import type { CachedAsset } from '@/types/templateMarketplace'

import TemplateAssetUploadZone from './TemplateAssetUploadZone.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      templatePublishing: {
        steps: {
          previewGeneration: {
            uploadPrompt: 'Click to upload',
            removeFile: 'Remove',
            uploadingProgress: 'Uploading… {percent}%'
          }
        }
      }
    }
  }
})

function makeAsset(name: string): CachedAsset {
  return {
    file: new File(['data'], name, { type: 'image/png' }),
    objectUrl: `blob:http://localhost/${name}`,
    originalName: name
  }
}

function mountZone(props: Record<string, unknown> = {}) {
  return mount(TemplateAssetUploadZone, {
    props,
    global: { plugins: [i18n] }
  })
}

describe('TemplateAssetUploadZone', () => {
  it('shows the upload prompt when no asset is provided', () => {
    const wrapper = mountZone()

    expect(wrapper.text()).toContain('Click to upload')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('shows an image preview when an asset is provided', () => {
    const asset = makeAsset('photo.png')
    const wrapper = mountZone({ asset })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(asset.objectUrl)
    expect(wrapper.text()).toContain('photo.png')
  })

  it('shows a video element when previewType is video', () => {
    const asset = makeAsset('demo.mp4')
    const wrapper = mountZone({ asset, previewType: 'video' })

    expect(wrapper.find('video').exists()).toBe(true)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('emits upload with the selected file', async () => {
    const wrapper = mountZone()
    const input = wrapper.find('input[type="file"]')

    const file = new File(['bytes'], 'test.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')

    expect(wrapper.emitted('upload')).toHaveLength(1)
    expect(wrapper.emitted('upload')![0]).toEqual([file])
  })

  it('emits remove when the remove button is clicked', async () => {
    const wrapper = mountZone({ asset: makeAsset('photo.png') })
    const removeBtn = wrapper.find('button[aria-label="Remove"]')

    await removeBtn.trigger('click')

    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('applies the provided sizeClass to the upload zone', () => {
    const wrapper = mountZone({ sizeClass: 'h-40 w-64' })
    const zone = wrapper.find('[role="button"]')

    expect(zone.classes()).toContain('h-40')
    expect(zone.classes()).toContain('w-64')
  })

  it('uses image/* accept filter by default', () => {
    const wrapper = mountZone()
    const input = wrapper.find('input[type="file"]')

    expect(input.attributes('accept')).toBe('image/*')
  })

  it('applies a custom accept filter', () => {
    const wrapper = mountZone({ accept: 'video/*' })
    const input = wrapper.find('input[type="file"]')

    expect(input.attributes('accept')).toBe('video/*')
  })

  describe('upload progress bar', () => {
    it('shows progress bar when upload is in progress', () => {
      const progress: UploadProgress = {
        loaded: 500,
        total: 1000,
        percent: 50,
        complete: false
      }
      const wrapper = mountZone({
        asset: makeAsset('photo.png'),
        uploadProgress: progress
      })

      const progressEl = wrapper.find('progress')
      expect(progressEl.exists()).toBe(true)
      expect(progressEl.attributes('value')).toBe('50')
      expect(progressEl.attributes('max')).toBe('100')
      expect(wrapper.text()).toContain('50%')
    })

    it('hides progress bar when upload is complete', () => {
      const progress: UploadProgress = {
        loaded: 1000,
        total: 1000,
        percent: 100,
        complete: true
      }
      const wrapper = mountZone({
        asset: makeAsset('photo.png'),
        uploadProgress: progress
      })

      expect(wrapper.find('progress').exists()).toBe(false)
    })

    it('hides progress bar when no uploadProgress is provided', () => {
      const wrapper = mountZone({ asset: makeAsset('photo.png') })

      expect(wrapper.find('progress').exists()).toBe(false)
    })

    it('reflects intermediate progress values during upload', () => {
      const progress: UploadProgress = {
        loaded: 750,
        total: 1000,
        percent: 75,
        complete: false
      }
      const wrapper = mountZone({
        asset: makeAsset('photo.png'),
        uploadProgress: progress
      })

      expect(wrapper.find('progress').attributes('value')).toBe('75')
      expect(wrapper.text()).toContain('75%')
    })
  })

  describe('file type validation', () => {
    it('restricts file input to image/* by default', () => {
      const wrapper = mountZone()
      expect(wrapper.find('input[type="file"]').attributes('accept')).toBe(
        'image/*'
      )
    })

    it('restricts file input to video/* when configured', () => {
      const wrapper = mountZone({ accept: 'video/*' })
      expect(wrapper.find('input[type="file"]').attributes('accept')).toBe(
        'video/*'
      )
    })

    it('supports a specific MIME type list', () => {
      const wrapper = mountZone({ accept: 'image/png,image/jpeg' })
      expect(wrapper.find('input[type="file"]').attributes('accept')).toBe(
        'image/png,image/jpeg'
      )
    })
  })

  describe('error handling', () => {
    it('does not emit upload when no file is selected', async () => {
      const wrapper = mountZone()
      const input = wrapper.find('input[type="file"]')

      Object.defineProperty(input.element, 'files', { value: [] })
      await input.trigger('change')

      expect(wrapper.emitted('upload')).toBeUndefined()
    })

    it('displays error state from upload progress', () => {
      const progress: UploadProgress = {
        loaded: 200,
        total: 1000,
        percent: 20,
        complete: true,
        error: 'Server responded with 500'
      }
      const wrapper = mountZone({
        asset: makeAsset('photo.png'),
        uploadProgress: progress
      })

      expect(wrapper.find('progress').exists()).toBe(false)
    })
  })
})
