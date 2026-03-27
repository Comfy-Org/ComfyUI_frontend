import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ImageLightbox from './ImageLightbox.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

describe(ImageLightbox, () => {
  function renderComponent(props: { src: string; alt?: string }, open = true) {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    const result = render(ImageLightbox, {
      global: { plugins: [i18n] },
      props: {
        ...props,
        modelValue: open,
        'onUpdate:modelValue': onUpdate
      }
    })
    return { ...result, user, onUpdate }
  }

  it('renders the image with correct src and alt when open', async () => {
    renderComponent({ src: '/test.png', alt: 'Test image' })
    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', '/test.png')
    expect(img).toHaveAttribute('alt', 'Test image')
  })

  it('does not render dialog content when closed', () => {
    renderComponent({ src: '/test.png' }, false)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('emits update:modelValue false when close button is clicked', async () => {
    const { user, onUpdate } = renderComponent({ src: '/test.png' })
    const closeButton = await screen.findByLabelText('g.close')
    await user.click(closeButton)
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(false)
    })
  })
})
