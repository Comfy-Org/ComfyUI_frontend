import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createApp, createSSRApp, defineComponent, h, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import type { UseCase } from '@/config/models-catalogue'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'

const useCaseOptions: FacetMenuOption[] = [
  { value: 'generate-images', label: 'Generate images', count: 4 },
  { value: '3d', label: '3D', count: 2 }
]

function mountMenu() {
  const useCases = ref<UseCase[]>([])
  render(
    defineComponent({
      setup: () => () =>
        h(WorkshopFilterMenu<UseCase>, {
          useCaseOptions,
          resultCount: 12,
          useCases: useCases.value,
          'onUpdate:useCases': (value: UseCase[]) => {
            useCases.value = value
          }
        })
    })
  )
  return { useCases }
}

describe('WorkshopFilterMenu', () => {
  it('hydrates desktop server markup on a phone and opens the mobile sheet without warnings', async () => {
    let phone = false
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: phone && query === '(width < 40rem)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    )
    const props = { useCaseOptions, resultCount: 12, useCases: [] }
    const container = document.createElement('div')
    container.innerHTML = await renderToString(
      createSSRApp(WorkshopFilterMenu, props)
    )
    document.body.append(container)
    phone = true
    // Only what hydration logs counts; the server render above may warn.
    vi.mocked(console.warn).mockClear()
    vi.mocked(console.error).mockClear()
    const app = createSSRApp(WorkshopFilterMenu, props)
    try {
      app.mount(container)
      await nextTick()
      expect(console.warn).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('workshop-filter'))
      const dialog = await screen.findByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(document.body).toHaveStyle({ overflow: 'hidden' })
      expect(container.contains(dialog)).toBe(false)
      await user.click(screen.getByTestId('workshop-filter-backdrop'))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(document.body).not.toHaveStyle({ overflow: 'hidden' })
      expect(console.warn).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()
    } finally {
      app.unmount()
      container.remove()
    }
  })

  it('opens and closes the phone sheet after its CCC island moves to a new document body', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(width < 40rem)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    )
    const previousBody = document.body
    const island = document.createElement('astro-island')
    island.setAttribute('data-astro-transition-persist', 'ccc-hub-catalogue-en')
    previousBody.append(island)
    const props = { useCaseOptions, resultCount: 12, useCases: [] }
    const app = createApp(WorkshopFilterMenu, props)
    const nextBody = document.createElement('body')
    try {
      app.mount(island)
      await nextTick()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('workshop-filter'))
      expect(await screen.findByRole('dialog')).toBeVisible()
      nextBody.append(island)
      previousBody.replaceWith(nextBody)
      document.dispatchEvent(new Event('astro:after-swap'))
      await nextTick()
      const nextView = within(nextBody)
      expect(nextView.queryByRole('dialog')).toBeNull()
      expect(document.body).not.toHaveStyle({ overflow: 'hidden' })
      await user.click(nextView.getByTestId('workshop-filter'))
      const dialog = await nextView.findByRole('dialog')
      expect(document.body.contains(dialog)).toBe(true)
      expect(island.contains(dialog)).toBe(false)
      expect(document.body).toHaveStyle({ overflow: 'hidden' })
      await user.click(nextView.getByTestId('workshop-filter-backdrop'))
      await waitFor(() => expect(nextView.queryByRole('dialog')).toBeNull())
      expect(document.body).not.toHaveStyle({ overflow: 'hidden' })
    } finally {
      app.unmount()
      nextBody.replaceWith(previousBody)
      island.remove()
    }
  })

  it('closes on Escape from inside the filter panel and restores trigger focus', async () => {
    const user = userEvent.setup()
    mountMenu()
    const trigger = screen.getByRole('button', { name: 'Use cases' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')
    const useCase = await within(dialog).findByRole('button', {
      name: 'Generate images 4'
    })
    expect(within(dialog).getByRole('searchbox')).toBeVisible()
    useCase.focus()
    await user.keyboard(' ')
    expect(useCase.getAttribute('aria-pressed')).toBe('true')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(trigger.matches(':focus')).toBe(true))
  })

  it('toggles a use case and counts it on the button and panel', async () => {
    const user = userEvent.setup()
    const { useCases } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(
      await screen.findByTestId('filter-useCase-generate-images')
    )
    expect(useCases.value).toEqual(['generate-images'])
    expect(screen.getByTestId('workshop-filter-count').textContent.trim()).toBe(
      '1'
    )
    expect(screen.getByTestId('workshop-filter-applied')).toHaveTextContent(
      '1 selected'
    )
  })

  it('narrows a facet with its search box', async () => {
    const user = userEvent.setup()
    const { useCases } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.type(
      await screen.findByTestId('workshop-filter-useCase-search'),
      'generate'
    )
    expect(screen.queryByTestId('filter-useCase-3d')).toBeNull()
    await user.click(screen.getByTestId('filter-useCase-generate-images'))
    expect(useCases.value).toEqual(['generate-images'])
  })

  it('clears selected use cases', async () => {
    const user = userEvent.setup()
    const { useCases } = mountMenu()

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('filter-useCase-3d'))
    await user.click(screen.getByTestId('workshop-filter-clear'))
    expect(useCases.value).toEqual([])
    expect(screen.queryByTestId('workshop-filter-count')).toBeNull()
  })
})
