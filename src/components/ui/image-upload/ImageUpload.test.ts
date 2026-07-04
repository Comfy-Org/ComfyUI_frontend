import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import ImageUpload from './ImageUpload.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderImageUpload(props: Record<string, unknown> = {}) {
  return render(ImageUpload, {
    props,
    global: { plugins: [i18n] }
  })
}

describe('ImageUpload', () => {
  it('shows a placeholder when no image is set', () => {
    renderImageUpload({ modelValue: '' })
    expect(screen.getByText('Choose image')).toBeTruthy()
    expect(screen.queryByLabelText('Remove image')).toBeNull()
  })

  it('shows the image base name extracted from the URL', () => {
    renderImageUpload({
      modelValue:
        '/api/view?filename=backgrounds%2Fmountain+lake.png&type=input'
    })
    expect(screen.getByText('mountain lake.png')).toBeTruthy()
  })

  it('falls back to the icon when the preview image fails to load', async () => {
    renderImageUpload({ modelValue: '/api/view?filename=missing.png' })
    const img = screen.getByTestId('image-upload-preview')
    await fireEvent.error(img)
    expect(screen.queryByTestId('image-upload-preview')).toBeNull()
  })

  it('opens the file browser when the row is clicked', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderImageUpload({ modelValue: '' })
    const fileInput = screen.getByTestId<HTMLInputElement>('image-upload-input')
    const clickSpy = vi.spyOn(fileInput, 'click')

    await user.click(screen.getByText('Choose image'))

    expect(clickSpy).toHaveBeenCalled()
  })

  it('emits fileSelected when a file is picked', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { emitted } = renderImageUpload({ modelValue: '' })
    const file = new File(['x'], 'photo.png', { type: 'image/png' })

    await user.upload(
      screen.getByTestId<HTMLInputElement>('image-upload-input'),
      file
    )

    expect(emitted('fileSelected')).toEqual([[file]])
  })

  it('clears the model when the remove button is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderImageUpload({
      modelValue: '/api/view?filename=bg.png'
    })

    await user.click(screen.getByLabelText('Remove image'))

    expect(emitted('update:modelValue')).toEqual([['']])
  })
})
