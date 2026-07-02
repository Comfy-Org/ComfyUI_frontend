import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { ComponentProps } from 'vue-component-type-helpers'

import ShareAssetWarningBox from '@/platform/workflow/sharing/components/ShareAssetWarningBox.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      shareWorkflow: {
        privateAssetsDescription:
          'Your workflow contains private models and/or media files',
        mediaLabel: '{count} Media File | {count} Media Files',
        modelsLabel: '{count} Model | {count} Models',
        acknowledgeCheckbox: 'I understand these assets...'
      }
    }
  }
})

describe(ShareAssetWarningBox, () => {
  function renderComponent(
    props: Partial<ComponentProps<typeof ShareAssetWarningBox>> = {}
  ) {
    return render(ShareAssetWarningBox, {
      props: {
        items: [
          {
            id: 'asset-image',
            name: 'image.png',
            storage_url: '',
            preview_url: 'https://example.com/a.jpg',
            model: false,
            public: false,
            in_library: false
          },
          {
            id: 'model-default',
            name: 'model.safetensors',
            storage_url: '',
            preview_url: '',
            model: true,
            public: false,
            in_library: false
          }
        ],
        acknowledged: false,
        'onUpdate:acknowledged': props['onUpdate:acknowledged'],
        ...props
      },
      global: {
        plugins: [i18n],
        stubs: {
          BaseTooltip: { template: '<slot />' }
        }
      }
    })
  }

  it('renders warning text', () => {
    const { container } = renderComponent()
    expect(container.textContent).toContain(
      'Your workflow contains private models and/or media files'
    )
  })

  it('renders media and model collapsible sections', () => {
    const { container } = renderComponent()

    expect(container.textContent).toContain('1 Media File')
    expect(container.textContent).toContain('1 Model')
  })

  it('keeps at most one accordion section open at a time', async () => {
    const user = userEvent.setup()
    renderComponent()

    const mediaHeader = screen.getByTestId('section-header-media')
    const modelsHeader = screen.getByTestId('section-header-models')

    expect(mediaHeader).toHaveAttribute('aria-expanded', 'true')
    expect(modelsHeader).toHaveAttribute('aria-expanded', 'false')
    expect(mediaHeader).toHaveAttribute(
      'aria-controls',
      'section-content-media'
    )
    expect(modelsHeader).toHaveAttribute(
      'aria-controls',
      'section-content-models'
    )

    await user.click(modelsHeader)

    expect(mediaHeader).toHaveAttribute('aria-expanded', 'false')
    expect(modelsHeader).toHaveAttribute('aria-expanded', 'true')

    await user.click(mediaHeader)

    expect(mediaHeader).toHaveAttribute('aria-expanded', 'true')
    expect(modelsHeader).toHaveAttribute('aria-expanded', 'false')

    await user.click(mediaHeader)

    expect(mediaHeader).toHaveAttribute('aria-expanded', 'false')
    expect(modelsHeader).toHaveAttribute('aria-expanded', 'false')
  })

  it('defaults to media section when both sections are available', () => {
    renderComponent()

    const mediaHeader = screen.getByTestId('section-header-media')
    const modelsHeader = screen.getByTestId('section-header-models')

    expect(mediaHeader).toHaveAttribute('aria-expanded', 'true')
    expect(modelsHeader).toHaveAttribute('aria-expanded', 'false')
  })

  it('defaults to models section when media is unavailable', () => {
    const { container } = renderComponent({
      items: [
        {
          id: 'model-default',
          name: 'model.safetensors',
          storage_url: '',
          preview_url: '',
          model: true,
          public: false,
          in_library: false
        }
      ]
    })

    expect(container.textContent).toContain('1 Model')
    const modelsHeader = screen.getByTestId('section-header-models')

    expect(modelsHeader).toHaveAttribute('aria-expanded', 'true')
  })

  it('allows collapsing the only expanded section when models are unavailable', async () => {
    const user = userEvent.setup()
    renderComponent({
      items: [
        {
          id: 'asset-image',
          name: 'image.png',
          storage_url: '',
          preview_url: 'https://example.com/a.jpg',
          model: false,
          public: false,
          in_library: false
        }
      ]
    })

    const mediaHeader = screen.getByTestId('section-header-media')

    expect(mediaHeader).toHaveAttribute('aria-expanded', 'true')

    await user.click(mediaHeader)

    expect(mediaHeader).toHaveAttribute('aria-expanded', 'false')
  })

  it('emits acknowledged update when checkbox is toggled', async () => {
    const onUpdateAcknowledged = vi.fn()
    const user = userEvent.setup()
    renderComponent({ 'onUpdate:acknowledged': onUpdateAcknowledged })

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(onUpdateAcknowledged).toHaveBeenCalledWith(true)
  })

  it('displays asset names in the assets section', () => {
    const { container } = renderComponent()

    expect(container.textContent).toContain('image.png')
  })

  it('renders thumbnail previews for assets when URLs are available', () => {
    renderComponent()

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('src', 'https://example.com/a.jpg')
    expect(images[0]).toHaveAttribute('alt', 'image.png')
  })

  it('renders fallback icon when thumbnail is missing', () => {
    const { container } = renderComponent({
      items: [
        {
          id: 'asset-image',
          name: 'image.png',
          storage_url: '',
          preview_url: '',
          model: false,
          public: false,
          in_library: false
        },
        {
          id: 'model-default',
          name: 'model.safetensors',
          storage_url: '',
          preview_url: '',
          model: true,
          public: false,
          in_library: false
        }
      ]
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const fallbackIcons = Array.from(container.querySelectorAll('i')).filter(
      (i) => i.classList.contains('icon-[lucide--image]')
    )

    expect(fallbackIcons).toHaveLength(1)
  })

  it('hides assets section when no assets provided', () => {
    const { container } = renderComponent({
      items: [
        {
          id: 'model-default',
          name: 'model.safetensors',
          storage_url: '',
          preview_url: '',
          model: true,
          public: false,
          in_library: false
        }
      ]
    })

    expect(container.textContent).not.toContain('Media File')
  })

  it('hides models section when no models provided', () => {
    const { container } = renderComponent({
      items: [
        {
          id: 'asset-image',
          name: 'image.png',
          storage_url: '',
          preview_url: '',
          model: false,
          public: false,
          in_library: false
        }
      ]
    })

    expect(container.textContent).not.toContain('Model')
  })
})
