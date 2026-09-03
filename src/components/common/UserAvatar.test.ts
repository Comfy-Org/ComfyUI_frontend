import type { ComponentProps } from 'vue-component-type-helpers'

import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

const useImageMock = vi.hoisted(() => ({
  error: null as Ref<unknown> | null
}))

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  const { ref } = await import('vue')
  useImageMock.error = ref<unknown>(null)
  return {
    ...(actual as Record<string, unknown>),
    useImage: () => ({ error: useImageMock.error })
  }
})

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
  beforeEach(() => {
    if (useImageMock.error) useImageMock.error.value = null
  })

  function renderComponent(props: ComponentProps<typeof UserAvatar> = {}) {
    return render(UserAvatar, {
      global: {
        plugins: [PrimeVue, i18n]
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

  it('falls back to icon when image fails to load', async () => {
    renderComponent({
      photoUrl: 'https://example.com/broken-image.jpg'
    })

    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.queryByTestId('avatar-icon')).not.toBeInTheDocument()

    useImageMock.error!.value = new Event('error')
    await nextTick()

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
