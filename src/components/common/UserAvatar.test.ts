import type { ComponentProps } from 'vue-component-type-helpers'

import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import UserAvatar from './UserAvatar.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      auth: {
        login: {
          userAvatar: 'User Avatar'
        }
      }
    }
  }
})

describe('UserAvatar', () => {
  function renderComponent(props: ComponentProps<typeof UserAvatar> = {}) {
    return render(UserAvatar, {
      global: {
        plugins: [i18n]
      },
      props
    })
  }

  it('renders correctly with photo Url', () => {
    renderComponent({
      photoUrl: 'https://example.com/avatar.jpg'
    })

    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg'
    )
    expect(screen.queryByTestId('avatar-icon')).not.toBeInTheDocument()
  })

  it('renders with default icon when no photo Url is provided', () => {
    renderComponent({
      photoUrl: undefined
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('avatar-icon')).toBeInTheDocument()
  })

  it('renders with default icon when provided photo Url is null', () => {
    renderComponent({
      photoUrl: null
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('avatar-icon')).toBeInTheDocument()
  })

  it('falls back on image error and retries when the photo URL changes', async () => {
    const { rerender } = renderComponent({
      photoUrl: 'https://example.com/broken-image.jpg'
    })

    const img = screen.getByRole('img')
    expect(screen.queryByTestId('avatar-icon')).not.toBeInTheDocument()

    await fireEvent.error(img)
    await nextTick()

    expect(screen.getByTestId('avatar-icon')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await rerender({ ariaLabel: 'Updated label' })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await rerender({ photoUrl: 'https://example.com/replacement.jpg' })
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/replacement.jpg'
    )
    expect(screen.queryByTestId('avatar-icon')).not.toBeInTheDocument()

    await fireEvent.error(screen.getByRole('img'))
    expect(screen.getByTestId('avatar-icon')).toBeInTheDocument()
  })

  it('uses provided ariaLabel', () => {
    renderComponent({
      photoUrl: 'https://example.com/avatar.jpg',
      ariaLabel: 'Custom Label'
    })

    expect(screen.getByLabelText('Custom Label')).toBeInTheDocument()
  })

  it('falls back to i18n translation when no ariaLabel is provided', () => {
    renderComponent({
      photoUrl: 'https://example.com/avatar.jpg'
    })

    expect(screen.getByLabelText('User Avatar')).toBeInTheDocument()
  })
})
