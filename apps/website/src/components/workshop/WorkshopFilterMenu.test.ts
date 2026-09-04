// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
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

function mountMenu() {
  const capabilities = ref<string[]>([])
  const providers = ref<string[]>([])
  const modalities = ref<string[]>([])
  render(
    defineComponent({
      setup: () => () =>
        h(WorkshopFilterMenu, {
          capabilityOptions,
          providerOptions,
          modalityOptions,
          capabilities: capabilities.value,
          providers: providers.value,
          modalities: modalities.value,
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
  return { capabilities, providers, modalities }
}

describe('WorkshopFilterMenu', () => {
  it('switches facets, toggles an option and counts it on the button and tab', async () => {
    const user = userEvent.setup()
    const { capabilities } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    expect(await screen.findByTestId('filter-provider-Kling')).toBeTruthy()
    expect(screen.queryByTestId('filter-capability-Upscale')).toBeNull()

    await user.click(screen.getByTestId('workshop-facet-capability'))
    await user.click(await screen.findByTestId('filter-capability-Upscale'))
    expect(capabilities.value).toEqual(['Upscale'])
    expect(
      screen.getByTestId('workshop-filter-count').textContent?.trim()
    ).toBe('1')
    expect(
      screen.getByTestId('workshop-facet-capability-count').textContent?.trim()
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
