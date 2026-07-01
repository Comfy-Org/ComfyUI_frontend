import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useToastStore } from '@/platform/updates/common/toastStore'

import BackgroundImageUpload from './BackgroundImageUpload.vue'

const fetchApi = vi.hoisted(() => vi.fn())
vi.mock('@/scripts/api', () => ({ api: { fetchApi } }))
vi.mock('@/platform/distribution/cloudPreviewUtil', () => ({
  appendCloudResParam: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

interface ImageUploadStubProps {
  modelValue?: string
  loading?: boolean
}

const imageUploadEmit = vi.hoisted(() => ({ current: null as null | unknown }))

const ImageUploadStub = {
  props: ['modelValue', 'loading'],
  emits: ['update:modelValue', 'fileSelected'],
  setup(_: ImageUploadStubProps, { emit }: { emit: unknown }) {
    imageUploadEmit.current = emit
    return () => null
  }
}

function renderUpload(modelValue = '') {
  const onUpdate = vi.fn()
  const utils = render(BackgroundImageUpload, {
    props: { modelValue, 'onUpdate:modelValue': onUpdate },
    global: {
      plugins: [i18n, createTestingPinia({ stubActions: false })],
      stubs: { ImageUpload: ImageUploadStub }
    }
  })
  const selectFile = (file: File) =>
    (imageUploadEmit.current as (e: string, f: File) => void)(
      'fileSelected',
      file
    )
  return { ...utils, onUpdate, selectFile }
}

const testFile = () => new File(['x'], 'photo.png', { type: 'image/png' })

describe('BackgroundImageUpload', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    fetchApi.mockReset()
  })

  it('sets the model to an /api/view URL after a successful upload', async () => {
    fetchApi.mockResolvedValue({
      status: 200,
      json: async () => ({ name: 'photo.png', subfolder: 'backgrounds' })
    })
    const { onUpdate, selectFile } = renderUpload()

    await selectFile(testFile())
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalled())

    const url = onUpdate.mock.calls.at(-1)?.[0] as string
    expect(url).toMatch(/^\/api\/view\?/)
    expect(url).toContain('filename=photo.png')
    expect(url).toContain('subfolder=backgrounds')
    // The uploaded folder is not duplicated into the filename param
    expect(url).not.toContain('filename=backgrounds')
  })

  it('shows a toast and does not set the model when upload fails', async () => {
    fetchApi.mockResolvedValue({
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({})
    })
    const { onUpdate, selectFile } = renderUpload()

    await selectFile(testFile())
    await vi.waitFor(() =>
      expect(useToastStore().addAlert).toHaveBeenCalledWith(
        'Failed to upload background image'
      )
    )
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('shows an error toast when the request throws', async () => {
    fetchApi.mockRejectedValue(new Error('network down'))
    const { selectFile } = renderUpload()

    await selectFile(testFile())
    await vi.waitFor(() =>
      expect(useToastStore().addAlert).toHaveBeenCalledWith(
        'Error uploading background image: Error: network down'
      )
    )
  })
})
