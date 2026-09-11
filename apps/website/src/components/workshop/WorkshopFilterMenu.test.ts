// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import WorkshopFilterMenu from './WorkshopFilterMenu.vue'

const capabilityOptions = [
  { value: 'Upscale', label: 'Upscale', count: 3 },
  { value: 'Lip sync', label: 'Lip sync', count: 2 }
]
const providerOptions = [
  { value: 'Kling', label: 'Kling', count: 3 },
  { value: 'Black Forest Labs', label: 'Black Forest Labs', count: 2 }
]
const modalityOptions = [
  { value: 'video', label: 'Video', count: 3 },
  { value: 'image', label: 'Image', count: 2 }
]
const useCaseOptions = [
  { value: 'generate-images', label: 'Generate images', count: 4 },
  { value: '3d', label: '3D', count: 2 }
]

function mountMenu(withUseCases = false) {
  const capabilities = ref<string[]>([])
  const providers = ref<string[]>([])
  const modalities = ref<string[]>([])
  const useCases = ref<string[]>([])
  render(
    defineComponent({
      setup: () => () =>
        h(WorkshopFilterMenu, {
          capabilityOptions,
          providerOptions,
          modalityOptions,
          useCaseOptions: withUseCases ? useCaseOptions : undefined,
          resultCount: 12,
          capabilities: capabilities.value,
          providers: providers.value,
          modalities: modalities.value,
          useCases: useCases.value,
          'onUpdate:useCases': (value: string[]) => {
            useCases.value = value
          },
          'onUpdate:capabilities': (value: string[]) => {
            capabilities.value = value
          },
          'onUpdate:providers': (value: string[]) => {
            providers.value = value
          },
          'onUpdate:modalities': (value: string[]) => {
            modalities.value = value
          }
        })
    })
  )
  return { capabilities, providers, modalities, useCases }
}

describe('WorkshopFilterMenu', () => {
  it('closes on Escape from inside the filter panel and restores trigger focus', async () => {
    const user = userEvent.setup()
    mountMenu()
    const trigger = screen.getByRole('button', { name: 'Filter' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')
    const provider = within(dialog).getByRole('button', { name: 'Kling 3' })
    provider.focus()
    await user.keyboard(' ')
    expect(provider.getAttribute('aria-pressed')).toBe('true')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('switches facets, toggles an option and counts it on the button and tab', async () => {
    const user = userEvent.setup()
    const { capabilities } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    expect(await screen.findByTestId('filter-provider-Kling')).toBeTruthy()
    expect(screen.queryByTestId('filter-capability-Upscale')).toBeNull()

    await user.click(screen.getByTestId('workshop-facet-capability'))
    await user.click(await screen.findByTestId('filter-capability-Upscale'))
    expect(capabilities.value).toEqual(['Upscale'])
    expect(screen.getByTestId('workshop-filter-count').textContent.trim()).toBe(
      '1'
    )
    expect(
      screen.getByTestId('workshop-facet-capability-count').textContent.trim()
    ).toBe('1')
  })

  it('narrows a facet with its search box', async () => {
    const user = userEvent.setup()
    const { providers } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.type(
      await screen.findByTestId('workshop-filter-provider-search'),
      'forest'
    )
    expect(screen.queryByTestId('filter-provider-Kling')).toBeNull()
    await user.click(screen.getByTestId('filter-provider-Black Forest Labs'))
    expect(providers.value).toEqual(['Black Forest Labs'])
  })

  it('counts a chosen use case, so it can be cleared like any other filter', async () => {
    const user = userEvent.setup()
    const { useCases } = mountMenu(true)

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('filter-useCase-3d'))
    expect(useCases.value).toEqual(['3d'])
    expect(screen.getByTestId('workshop-filter-count').textContent.trim()).toBe(
      '1'
    )

    await user.click(screen.getByTestId('workshop-filter-clear'))
    expect(useCases.value).toEqual([])
    expect(screen.queryByTestId('workshop-filter-count')).toBeNull()
  })

  it('clears every facet at once', async () => {
    const user = userEvent.setup()
    const { capabilities, providers } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('filter-provider-Kling'))
    await user.click(screen.getByTestId('workshop-facet-capability'))
    await user.click(await screen.findByTestId('filter-capability-Upscale'))
    await user.click(screen.getByTestId('workshop-filter-clear'))
    expect(capabilities.value).toEqual([])
    expect(providers.value).toEqual([])
  })
})
