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

function mountMenu() {
  const capabilities = ref<string[]>([])
  const providers = ref<string[]>([])
  render(
    defineComponent({
      setup: () => () =>
        h(WorkshopFilterMenu, {
          capabilityOptions,
          providerOptions,
          capabilities: capabilities.value,
          providers: providers.value,
          'onUpdate:capabilities': (value: string[]) => {
            capabilities.value = value
          },
          'onUpdate:providers': (value: string[]) => {
            providers.value = value
          }
        })
    })
  )
  return { capabilities, providers }
}

describe('WorkshopFilterMenu', () => {
  it('drills into a facet, toggles an option and counts it on the button', async () => {
    const user = userEvent.setup()
    const { capabilities } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    expect(screen.queryByTestId('filter-capability-Upscale')).toBeNull()
    await user.click(await screen.findByTestId('workshop-filter-capability'))
    await user.click(await screen.findByTestId('filter-capability-Upscale'))
    expect(capabilities.value).toEqual(['Upscale'])
    expect(
      screen.getByTestId('workshop-filter-count').textContent?.trim()
    ).toBe('1')

    await user.click(screen.getByTestId('workshop-filter-back'))
    expect(
      screen.getByTestId('workshop-filter-capability-count').textContent?.trim()
    ).toBe('1')
  })

  it('searches across both facets from the root box', async () => {
    const user = userEvent.setup()
    const { providers } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.type(await screen.findByTestId('workshop-filter-search'), 'l')
    expect(screen.getByTestId('filter-capability-Upscale')).toBeTruthy()
    expect(screen.getByTestId('filter-provider-Kling')).toBeTruthy()
    expect(screen.queryByTestId('workshop-filter-capability')).toBeNull()

    await user.click(screen.getByTestId('filter-provider-Kling'))
    expect(providers.value).toEqual(['Kling'])
  })

  it('clears every facet at once', async () => {
    const user = userEvent.setup()
    const { capabilities, providers } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.type(await screen.findByTestId('workshop-filter-search'), 'k')
    await user.click(screen.getByTestId('filter-provider-Kling'))
    await user.click(screen.getByTestId('workshop-filter-clear'))
    expect(capabilities.value).toEqual([])
    expect(providers.value).toEqual([])
  })
})
