import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref, createSSRApp, h, nextTick } from 'vue'
import type { Ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { workshopModels } from '@/config/workshop-browse-content'
import { workshopPages } from '@/config/workshop-page-content'
import './ModelPage.vue'
import './ModelsCatalogue.vue'
import { prepareModelPage } from '@/routes/models/model-page'
import {
  useWorkshopAppsEnabled,
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopWorkflowsEnabled,
  useWorkshopAuthFlag
} from '@/scripts/posthog'
import { FORWARD_GRACE_MS, forwardLegacySection } from './forwardLegacySection'
import type { HubSection } from '@/lib/workshop/hub-section'
import ModelsPage from './ModelsPage.vue'

vi.mock(import('@/scripts/posthog'))

let enabled: Ref<boolean>
let settled: Ref<boolean>
let workflowsEnabled: Ref<boolean>
let appsEnabled: Ref<boolean>

beforeEach(() => {
  enabled = ref(false)
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(enabled))
  settled = ref(true)
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(settled))
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(ref(false)))
  workflowsEnabled = ref(false)
  vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(
    readonly(workflowsEnabled)
  )
  appsEnabled = ref(false)
  vi.mocked(useWorkshopAppsEnabled).mockReturnValue(readonly(appsEnabled))
})

const modelSlug = 'bfl--flux-2-max--generate-images'
const modelPage = await prepareModelPage(modelSlug)

describe('Models page entry', () => {
  it('gates workflow data and mounts the shared controls when enabled', async () => {
    const slug = 'workflows/change-material'
    const fetchData = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(await prepareModelPage(slug)))
    vi.stubGlobal('fetch', fetchData)
    enabled.value = true
    render(ModelsPage, {
      props: { slug },
      slots: { fallback: '<h1>Public Models</h1>' }
    })
    expect(
      await screen.findByRole('heading', { name: 'Public Models' })
    ).toBeVisible()
    expect(fetchData).not.toHaveBeenCalled()
    workflowsEnabled.value = true
    expect(
      await screen.findByRole('heading', { name: 'Change a material' })
    ).toBeVisible()
    expect(fetchData).toHaveBeenCalledWith(
      '/models/workflows/change-material/page.json'
    )
    expect(
      screen.getByRole('textbox', { name: 'What should change?' })
    ).toBeVisible()
    expect(
      screen.getByRole('group', { name: 'Your original image' })
    ).toBeVisible()
    expect(screen.getByTestId('output-example')).toBeVisible()
    workflowsEnabled.value = false
    await nextTick()
    expect(screen.getByRole('heading', { name: 'Public Models' })).toBeVisible()
    expect(screen.getByTestId('workflow-hero')).not.toBeVisible()
  })

  it.for([undefined, modelSlug])(
    'server-renders only public content for %s',
    async (slug) => {
      const html = await renderToString(
        createSSRApp({
          render: () => h(ModelsPage, { slug })
        })
      )
      expect(html).toContain('workshop-loading')
      expect(html).not.toContain('workshop-search')
      expect(html).not.toContain('model-hero')
      expect(html).not.toContain('model-detail')
    }
  )

  it('server-renders a section heading over the loading state', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(ModelsPage, {
            section: 'workflows',
            heading: 'ComfyUI workflows'
          })
      })
    )
    expect(html).toMatch(/<h1\b[^>]*>ComfyUI workflows<\/h1>/)
    expect(html).toContain('workshop-loading')
  })

  function renderSection(section: HubSection) {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(workshopPages))
    )
    enabled.value = true
    render(ModelsPage, { props: { section, heading: 'Section heading' } })
    return screen.findByRole('heading', { name: 'Section heading' })
  }

  it.for([
    { section: 'explore', back: false },
    { section: 'apps', back: true },
    { section: 'workflows', back: true },
    { section: 'models', back: true }
  ] as const)(
    'heads $section with the Hub, as a way back only off the landing',
    async ({ section, back }) => {
      appsEnabled.value = true
      workflowsEnabled.value = true
      await renderSection(section)

      expect(
        screen.queryByRole('navigation', { name: 'Hub spaces' })
      ).toBeNull()
      expect(
        screen.queryByRole('link', { name: 'Hub' })?.getAttribute('href')
      ).toBe(back ? '/hub/' : undefined)
    }
  )

  it.for([
    { section: 'apps', current: 'Apps' },
    { section: 'workflows', current: 'Workflows' }
  ] as const)(
    'places $section under a Hub breadcrumb above the eyebrow',
    async ({ section, current }) => {
      appsEnabled.value = true
      workflowsEnabled.value = true
      await renderSection(section)

      const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
      expect(within(trail).getByRole('link', { name: 'Hub' })).toHaveAttribute(
        'href',
        '/hub/'
      )
      expect(within(trail).getByText(current)).toHaveAttribute(
        'aria-current',
        'page'
      )
    }
  )

  it('lays the breadcrumb in when the persisted landing swaps to workflows', async () => {
    workflowsEnabled.value = true
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(workshopPages))
    )
    enabled.value = true
    const { rerender } = render(ModelsPage, {
      props: { section: 'explore', heading: 'Section heading' }
    })
    await screen.findByRole('heading', { name: 'Section heading' })
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull()

    await rerender({ section: 'workflows', heading: 'Section heading' })

    expect(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText(
        'Workflows'
      )
    ).toHaveAttribute('aria-current', 'page')
  })

  it('adds the way back when the persisted landing swaps to a section', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(workshopPages))
    )
    enabled.value = true
    const { rerender } = render(ModelsPage, {
      props: { section: 'explore', heading: 'Section heading' }
    })
    await screen.findByRole('heading', { name: 'Section heading' })
    expect(screen.queryByTestId('hub-back')).toBeNull()

    await rerender({ section: 'models', heading: 'Section heading' })

    expect(screen.getByTestId('hub-back')).toHaveAttribute('href', '/hub/')
  })

  it('opens the explore page to visitors without the workshop flag', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(workshopPages))
    )
    render(ModelsPage, {
      props: { section: 'explore', heading: 'Explore heading' },
      slots: { fallback: '<h1>Public Models</h1>' }
    })

    expect(await screen.findByTestId('explore-results')).toBeVisible()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Explore heading'
    )
  })

  it.for([
    {
      section: 'workflows',
      catalogue: 'workflow-catalogue',
      turnOn: () => {
        workflowsEnabled.value = true
      }
    },
    {
      section: 'apps',
      catalogue: 'apps-catalogue',
      turnOn: () => {
        appsEnabled.value = true
      }
    }
  ] as const)(
    'keeps the $section section and its heading behind its flag',
    async ({ section, catalogue, turnOn }) => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(Response.json(workshopPages))
      )
      enabled.value = true
      render(ModelsPage, {
        props: { section, heading: 'Section heading' },
        slots: {
          fallback: '<h1>Public Models</h1>'
        }
      })
      expect(
        await screen.findByRole('heading', { name: 'Public Models' })
      ).toBeVisible()
      expect(
        screen.queryByRole('heading', { name: 'Section heading' })
      ).toBeNull()

      turnOn()
      expect(await screen.findByTestId(catalogue)).toBeVisible()
      expect(
        screen.getByRole('heading', { level: 1, name: 'Section heading' })
      ).toBeVisible()
      expect(
        screen.queryByRole('heading', { name: 'Public Models' })
      ).toBeNull()
    }
  )

  describe('an old ?type= catalogue link', () => {
    let replace: ReturnType<typeof vi.fn<(url: string | URL) => void>>
    let fetchData: ReturnType<typeof vi.fn<typeof fetch>>

    // ModelsPage reads the settled flag once during setup, synchronously inside
    // render(). The forward reads it again only after its chunk loads, right
    // before it starts watching the flags, so a read past the setup count means
    // the forward is pending on the flags.
    function renderUntilForwardPending() {
      const settledReads = vi.mocked(useWorkshopEnabledSettled).mock.calls
      const view = render(ModelsPage)
      const setupReads = settledReads.length
      return vi
        .waitFor(() => expect(settledReads.length).toBeGreaterThan(setupReads))
        .then(() => view)
    }

    beforeEach(() => {
      replace = vi.fn()
      vi.spyOn(window.location, 'replace').mockImplementation(replace)
      fetchData = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(workshopModels))
      vi.stubGlobal('fetch', fetchData)
      enabled.value = true
    })

    afterEach(() => {
      window.history.replaceState({}, '', '/')
    })

    it.for([
      {
        link: '/hub/models/?type=workflows&q=kling#top',
        turnOn: () => {
          workflowsEnabled.value = true
        },
        target: '/hub/workflows/?q=kling#top'
      },
      {
        link: '/hub/models/?type=workflow',
        turnOn: () => {
          workflowsEnabled.value = true
        },
        target: '/hub/workflows/'
      },
      {
        link: '/hub/models/?model=LTX-2.3&type=apps',
        turnOn: () => {
          appsEnabled.value = true
        },
        target: '/hub/apps/?model=LTX-2.3'
      }
    ])(
      'forwards $link to its section once the flags answer with it on',
      async ({ link, turnOn, target }) => {
        window.history.replaceState({}, '', link)
        settled.value = false
        await renderUntilForwardPending()
        expect(screen.getByTestId('models-loading')).toBeTruthy()
        expect(replace).not.toHaveBeenCalled()

        turnOn()
        settled.value = true
        await vi.waitFor(() =>
          expect(replace).toHaveBeenCalledExactlyOnceWith(
            new URL(target, location.origin).href
          )
        )
        expect(screen.getByTestId('models-loading')).toBeTruthy()
      }
    )

    it('waits for settled flags before forwarding when both flags are enabled', async () => {
      window.history.replaceState({}, '', '/hub/models/?type=workflows')
      settled.value = false
      workflowsEnabled.value = true
      const controller = new AbortController()
      const forwarding = forwardLegacySection(location.href, controller.signal)

      try {
        await nextTick()
        expect(replace).not.toHaveBeenCalled()

        settled.value = true
        await nextTick()
        expect(replace).toHaveBeenCalledExactlyOnceWith(
          new URL('/hub/workflows/', location.origin).href
        )
        await vi.advanceTimersByTimeAsync(FORWARD_GRACE_MS)
        await forwarding
      } finally {
        controller.abort()
      }
    })

    it('loads the models catalogue while it waits for the flags', async () => {
      window.history.replaceState({}, '', '/hub/models/?type=workflows')
      settled.value = false
      render(ModelsPage)
      await vi.waitFor(() =>
        expect(fetchData).toHaveBeenCalledExactlyOnceWith(
          '/models/catalogue.json'
        )
      )
      expect(screen.getByTestId('models-loading')).toBeTruthy()

      settled.value = true
      expect(await screen.findByTestId('workshop-search')).toBeTruthy()
      expect(replace).not.toHaveBeenCalled()
    })

    it('waits for the page to finish parsing before trusting the flags', async () => {
      window.history.replaceState({}, '', '/hub/models/?type=workflows')
      const readyState = vi
        .spyOn(document, 'readyState', 'get')
        .mockReturnValue('loading')
      render(ModelsPage)
      await expect(
        screen.findByTestId('workshop-search', undefined, { timeout: 200 })
      ).rejects.toThrow()
      expect(replace).not.toHaveBeenCalled()

      workflowsEnabled.value = true
      readyState.mockReturnValue('interactive')
      document.dispatchEvent(new Event('DOMContentLoaded'))
      await vi.waitFor(() =>
        expect(replace).toHaveBeenCalledExactlyOnceWith(
          new URL('/hub/workflows/', location.origin).href
        )
      )
    })

    it('forwards once the section turns on after the catalogue loaded, and only once', async () => {
      window.history.replaceState({}, '', '/hub/models/?type=workflows')
      render(ModelsPage)
      expect(await screen.findByTestId('workshop-search')).toBeTruthy()

      workflowsEnabled.value = true
      await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce())
      workflowsEnabled.value = false
      await nextTick()
      workflowsEnabled.value = true
      await nextTick()
      expect(replace).toHaveBeenCalledOnce()
    })

    it('shows the models catalogue when the browser stays put after a forward', async () => {
      window.history.replaceState({}, '', '/hub/models/?type=workflows')
      workflowsEnabled.value = true
      render(ModelsPage)
      await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce())
      expect(screen.getByTestId('models-loading')).toBeTruthy()

      await vi.advanceTimersByTimeAsync(FORWARD_GRACE_MS)
      expect(await screen.findByTestId('workshop-search')).toBeTruthy()
    })

    it('does not forward a visitor who moved on before the flags answered', async () => {
      window.history.replaceState({}, '', '/hub/models/?type=workflows')
      settled.value = false
      await renderUntilForwardPending()

      window.history.replaceState({}, '', '/hub/models/?q=kling')
      workflowsEnabled.value = true
      settled.value = true
      expect(await screen.findByTestId('workshop-search')).toBeTruthy()
      expect(replace).not.toHaveBeenCalled()
    })

    it('acts on the link the page opened with, not one that replaced it while loading', async () => {
      window.history.replaceState({}, '', '/hub/models/?type=workflows')
      fetchData.mockImplementation(async () => {
        window.history.replaceState({}, '', '/hub/models/?type=apps')
        return Response.json(workshopModels)
      })
      workflowsEnabled.value = true
      appsEnabled.value = true
      render(ModelsPage)
      expect(await screen.findByTestId('workshop-search')).toBeTruthy()
      expect(replace).not.toHaveBeenCalled()
    })

    it('stops forwarding once the page unmounts', async () => {
      window.history.replaceState({}, '', '/hub/models/?type=workflows')
      settled.value = false
      const { unmount } = await renderUntilForwardPending()

      unmount()
      workflowsEnabled.value = true
      settled.value = true
      await vi.advanceTimersByTimeAsync(FORWARD_GRACE_MS)
      expect(replace).not.toHaveBeenCalled()
    })

    it.for([
      { link: '/hub/models/?type=workflows', workshop: true },
      { link: '/hub/models/?type=apps', workshop: true },
      { link: '/hub/models/?type=workflows', workshop: false }
    ])(
      'keeps the models catalogue for $link while its section is off (workshop $workshop)',
      async ({ link, workshop }) => {
        window.history.replaceState({}, '', link)
        enabled.value = workshop
        workflowsEnabled.value = !workshop
        appsEnabled.value = !workshop
        render(ModelsPage)
        expect(await screen.findByTestId('workshop-search')).toBeTruthy()
        expect(replace).not.toHaveBeenCalled()
      }
    )
  })

  it('gives the hub heading to a category, and takes it back', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(workshopPages))
    )
    enabled.value = true
    workflowsEnabled.value = true
    render(ModelsPage, {
      props: { section: 'models', heading: 'Models heading' },
      slots: { fallback: '<h1>Public Models</h1>' }
    })
    expect(await screen.findByTestId('workshop-search')).toBeVisible()
    const headingWrapper = () => screen.getByTestId('workshop-heading')

    expect(headingWrapper()).not.toHaveClass('sr-only')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Models heading' })
    ).toBeVisible()

    await user.click(screen.getByTestId('browse-all-end'))
    expect(headingWrapper()).toHaveClass('sr-only')
    // Hidden, not removed: the page still owns the only h1.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Models heading' })
    ).toBeInTheDocument()

    await user.click(screen.getByTestId('section-back'))
    expect(headingWrapper()).not.toHaveClass('sr-only')
  })

  it('switches the loaded catalogue and heading without fetching its data again', async () => {
    const fetchData = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(workshopPages))
    vi.stubGlobal('fetch', fetchData)
    enabled.value = true
    workflowsEnabled.value = true
    appsEnabled.value = true
    const view = render(ModelsPage, {
      props: { section: 'models', heading: 'Models heading' },
      slots: { fallback: '<h1>Public Models</h1>' }
    })
    expect(await screen.findByTestId('workshop-search')).toBeVisible()

    await view.rerender({ section: 'workflows', heading: 'Workflows heading' })
    expect(await screen.findByTestId('workflow-catalogue')).toBeVisible()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Workflows heading'
    )
    await view.rerender({ section: 'apps', heading: 'Apps heading' })
    expect(await screen.findByTestId('apps-catalogue')).toBeVisible()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Apps heading'
    )
    await view.rerender({ section: 'models', heading: 'Models heading' })
    expect(await screen.findByTestId('workshop-search')).toBeVisible()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Models heading'
    )
    expect(fetchData).toHaveBeenCalledExactlyOnceWith('/models/catalogue.json')
    expect(
      vi
        .mocked(captureWorkshopEvent)
        .mock.calls.flatMap(([event]) =>
          event.name === 'catalogue_viewed' ? [event.properties.page_type] : []
        )
    ).toEqual(['model', 'workflow', 'app', 'model'])

    enabled.value = false
    await view.rerender({ section: 'apps', heading: 'Apps heading' })
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Public Models'
    )
    expect(screen.queryByTestId('apps-catalogue')).toBeNull()
    await view.rerender({ section: 'models', heading: 'Models heading' })
    expect(await screen.findByTestId('workshop-search')).toBeVisible()
    expect(fetchData).toHaveBeenCalledOnce()
  })

  it('keeps a workflow page behind its gate while the workshop flag is off', async () => {
    const fetchData = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchData)
    workflowsEnabled.value = true
    render(ModelsPage, {
      props: { slug: 'workflows/change-material' },
      slots: { fallback: '<h1>Public Models</h1>' }
    })
    expect(
      await screen.findByRole('heading', { name: 'Public Models' })
    ).toBeVisible()
    expect(fetchData).not.toHaveBeenCalled()
  })

  it('adds workflows to the landing when their flag answers late', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(workshopPages))
    )
    render(ModelsPage, {
      props: { section: 'explore', heading: 'Explore heading' }
    })
    const kinds = () =>
      screen.queryAllByTestId('explore-kind').map((tag) => tag.dataset.kind)
    await screen.findByTestId('explore-results')
    expect(kinds()).not.toContain('workflow')

    workflowsEnabled.value = true
    await waitFor(() => expect(kinds()).toContain('workflow'))
  })

  it.for([
    { slug: undefined, visible: 'workshop-search', flag: 'off' },
    { slug: modelSlug, visible: 'model-hero', flag: 'off' },
    { slug: undefined, visible: 'workshop-search', flag: 'unanswered' },
    { slug: modelSlug, visible: 'model-hero', flag: 'unanswered' },
    { slug: modelSlug, visible: 'model-hero', flag: 'on' }
  ] as const)(
    'shows $visible when the flag is $flag',
    async ({ slug, visible, flag }) => {
      const fetchData = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(slug ? modelPage : workshopModels))
      vi.stubGlobal('fetch', fetchData)
      enabled.value = flag === 'on'
      settled.value = flag !== 'unanswered'
      render(ModelsPage, { props: { slug } })
      expect(await screen.findByTestId(visible)).toBeTruthy()
      if (slug) {
        expect(
          screen.getByRole('heading', {
            level: 1,
            name: 'FLUX 2 Max Text-to-Image'
          })
        ).toBeTruthy()
        expect(screen.getByTestId('model-detail')).toBeTruthy()
        expect(screen.getByTestId('model-tags')).toBeTruthy()
        expect(screen.getByTestId('related-models').textContent).toContain(
          'Browse all'
        )
        expect(
          within(screen.getByTestId('model-hero')).getByRole('link', {
            name: 'Generate images'
          })
        ).toHaveAttribute('href', '/hub/models/?useCase=generate-images')
      }
      enabled.value = !enabled.value
      await nextTick()
      expect(screen.getByTestId(visible)).toBeVisible()
    }
  )
})
