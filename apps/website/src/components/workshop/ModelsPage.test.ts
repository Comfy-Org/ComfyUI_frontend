// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableMainFrameNavigation":true,"disableChildPageNavigation":true}}}
import { respondToFetch } from '@comfyorg/test-utils/fetch'
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref, createSSRApp, h, nextTick } from 'vue'
import type { Ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { workshopModels } from '@/config/workshop-browse-content'
import type { WorkshopModel } from '@/config/models-catalogue'
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

const CATALOGUE_URL = '/models/catalogue.json'
const modelSlug = 'bfl--flux-2-max--generate-images'
const modelPage = await prepareModelPage(modelSlug)
const selectedWorkflowPage = await prepareModelPage('workflows/change-material')
if (
  selectedWorkflowPage.kind !== 'page' ||
  selectedWorkflowPage.model.routerId !== undefined
)
  throw new Error('Missing workflow detail fixture')
const selectedWorkflow = selectedWorkflowPage.model

describe('Models page entry', () => {
  it('shows a server-selected workflow independently of browse flags without fetching twice', async () => {
    enabled.value = true
    render(ModelsPage, {
      props: {
        slug: selectedWorkflow.slug,
        workflowId: selectedWorkflow.workflowId,
        initialWorkflow: {
          ...selectedWorkflow,
          name: 'Selected Draft workflow'
        }
      },
      slots: { fallback: '<h1>Public Models</h1>' }
    })
    expect(
      await screen.findByRole('heading', { name: 'Selected Draft workflow' })
    ).toBeVisible()
    workflowsEnabled.value = true
    expect(
      await screen.findByRole('heading', { name: 'Selected Draft workflow' })
    ).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: 'What should change?' })
    ).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
    workflowsEnabled.value = false
    await nextTick()
    expect(
      screen.getByRole('heading', { name: 'Selected Draft workflow' })
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Public Models' })).toBeNull()
  })

  it('replaces a selected workflow snapshot without reusing stale detail data', async () => {
    enabled.value = true
    workflowsEnabled.value = true
    const view = render(ModelsPage, {
      props: {
        slug: selectedWorkflow.slug,
        workflowId: selectedWorkflow.workflowId,
        initialWorkflow: {
          ...selectedWorkflow,
          name: 'First selected workflow'
        }
      }
    })
    expect(
      await screen.findByRole('heading', { name: 'First selected workflow' })
    ).toBeVisible()
    await view.rerender({
      initialWorkflow: { ...selectedWorkflow, name: 'Fresh selected workflow' }
    })
    expect(
      await screen.findByRole('heading', { name: 'Fresh selected workflow' })
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'First selected workflow' })
    ).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.for([
    {
      slug: 'workflows/another-route',
      workflowId: 'workflows/change-material'
    },
    {
      slug: 'workflows/change-material',
      workflowId: 'workflows/another-workflow'
    }
  ])(
    'refuses initial workflow data with mismatched identity $slug / $workflowId',
    async (identity) => {
      enabled.value = true
      workflowsEnabled.value = true
      respondToFetch('/models/workflows/change-material/page.json', () =>
        Response.json(selectedWorkflowPage)
      )
      render(ModelsPage, {
        props: {
          slug: selectedWorkflow.slug,
          workflowId: selectedWorkflow.workflowId,
          initialWorkflow: {
            ...selectedWorkflow,
            ...identity,
            name: 'Wrong workflow'
          }
        }
      })
      expect(
        await screen.findByRole('heading', { name: 'Change a material' })
      ).toBeVisible()
      expect(
        screen.queryByRole('heading', { name: 'Wrong workflow' })
      ).toBeNull()
      expect(fetch).toHaveBeenCalledExactlyOnceWith(
        '/models/workflows/change-material/page.json'
      )
    }
  )
  it('replaces a persisted selected snapshot reactively and keeps its catalogue mounted across sections', async () => {
    const selected = workshopModels
      .slice(0, 1)
      .map((model) => ({ ...model, name: 'Original selected model' }))
    const view = render(ModelsPage, {
      props: { initialModels: selected, initialCatalogAvailable: true }
    })
    await screen.findAllByText('Original selected model')
    const hero = screen.getByTestId('workshop-hero')
    await view.rerender({
      initialModels: selected.map((model) => ({
        ...model,
        name: 'Fresh server model'
      }))
    })
    expect(await screen.findAllByText('Fresh server model')).not.toHaveLength(0)
    expect(screen.queryByText('Original selected model')).toBeNull()
    expect(screen.getByTestId('workshop-hero')).toBe(hero)
    await view.rerender({ section: 'workflows' })
    expect(await screen.findByTestId('workflow-catalogue')).toBeVisible()
    expect(screen.getByTestId('workshop-hero')).toBe(hero)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('removes private selected rows when a persisted island receives public non-CMS props', async () => {
    const pending = Promise.withResolvers<Response>()
    vi.mocked(fetch).mockReturnValue(pending.promise)
    const selected = workshopModels
      .slice(0, 1)
      .map((model) => ({ ...model, name: 'Private Draft model' }))
    const view = render(ModelsPage, {
      props: { initialModels: selected, initialCatalogAvailable: true }
    })
    await screen.findAllByText('Private Draft model')
    await view.rerender({
      initialModels: undefined,
      initialCatalogAvailable: false
    })
    await vi.waitFor(() =>
      expect(screen.queryByText('Private Draft model')).toBeNull()
    )
    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledExactlyOnceWith('/models/catalogue.json')
    )
    pending.resolve(
      Response.json(
        workshopModels
          .slice(0, 1)
          .map((model) => ({ ...model, name: 'Public catalogue model' }))
      )
    )
    expect(
      await screen.findAllByText('Public catalogue model')
    ).not.toHaveLength(0)
    expect(screen.queryByText('Private Draft model')).toBeNull()
  })

  it('changes the heading with the selected snapshot tab before fresh navigation data arrives', async () => {
    render(ModelsPage, {
      props: {
        initialModels: workshopPages,
        initialCatalogAvailable: true,
        initialHeadings: {
          models: 'Models heading',
          workflows: 'Workflows heading',
          apps: 'Apps heading'
        },
        heading: 'Models heading'
      }
    })
    await screen.findByTestId('catalogue-tab-workflows')
    await userEvent.setup().click(screen.getByTestId('catalogue-tab-workflows'))
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Workflows heading'
      })
    ).toBeVisible()
    expect(await screen.findByTestId('workflow-catalogue')).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps an existing authorized Add action aligned with the intended tab and restores it on rollback', async () => {
    const create = document.createElement('a')
    create.dataset.cccCreateContent = ''
    create.href = '/admin/content/new?type=model'
    document.body.append(create)
    try {
      render(ModelsPage, {
        props: { initialModels: workshopPages, initialCatalogAvailable: true }
      })
      await screen.findByTestId('catalogue-tab-workflows')
      await userEvent
        .setup()
        .click(screen.getByTestId('catalogue-tab-workflows'))
      await vi.waitFor(() =>
        expect(create).toHaveAttribute(
          'href',
          '/admin/content/new?type=workflow'
        )
      )
      await vi.advanceTimersByTimeAsync(5_000)
      await vi.waitFor(() =>
        expect(create).toHaveAttribute('href', '/admin/content/new?type=model')
      )
    } finally {
      create.remove()
    }
  })

  it.for([
    { section: 'models' },
    { section: 'workflows' },
    { section: 'apps' }
  ] as const)(
    'server-renders the selected initial $section catalogue without a second data fetch',
    async ({ section }) => {
      const catalogues: Record<typeof section, WorkshopModel[]> = {
        models: [
          {
            routerId: 'selected-model',
            slug: 'selected-model',
            href: '/hub/models/selected-model/',
            name: 'Selected model',
            workflowCount: 0,
            capabilities: [],
            useCases: ['generate-images']
          }
        ],
        workflows: [
          {
            type: 'CLOUD',
            workflowId: 'selected-workflow',
            slug: 'workflows/selected-workflow',
            href: '/hub/workflows/selected-workflow/',
            name: 'Selected workflow',
            workflowCount: 1,
            capabilities: [],
            category: 'cleanup'
          }
        ],
        apps: [
          {
            type: 'APP',
            appId: 'studio',
            slug: 'apps/selected-app',
            href: '/hub/apps/selected-app/',
            name: 'Selected app',
            workflowCount: 0,
            capabilities: []
          }
        ]
      }
      const selected = catalogues[section]
      settled.value = false
      const html = await renderToString(
        createSSRApp({
          render: () =>
            h(ModelsPage, {
              section,
              initialModels: selected,
              initialCatalogAvailable: true
            })
        })
      )
      expect(html).toContain(selected[0].name)
      expect(html).not.toContain('workshop-loading')
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('hydrates the server-selected catalogue without fetching another selection', async () => {
    const selected = workshopModels.slice(0, 1).map((model) => ({
      ...model,
      name: 'Selected Draft model'
    }))
    const props = {
      initialModels: selected,
      initialCatalogAvailable: true
    }
    const container = document.createElement('div')
    container.innerHTML = await renderToString(createSSRApp(ModelsPage, props))
    document.body.append(container)
    const app = createSSRApp(ModelsPage, props)
    try {
      app.mount(container)
      expect(
        await screen.findAllByText('Selected Draft model')
      ).not.toHaveLength(0)
      await vi.waitFor(() =>
        expect(screen.getByTestId('workshop-search')).toBeEnabled()
      )
      expect(screen.queryByTestId('models-loading')).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      app.unmount()
      container.remove()
    }
  })

  it('does not treat unverified initial data as an available catalogue', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () => h(ModelsPage, { initialModels: workshopModels })
      })
    )
    expect(html).toContain('workshop-loading')
    expect(html).not.toContain('workshop-search')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('server-renders an empty selected catalogue without falling back to static records', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(ModelsPage, {
            initialModels: [],
            initialCatalogAvailable: true
          })
      })
    )
    expect(html).toContain('workshop-search')
    expect(html).not.toContain(workshopModels[0].name)
    expect(html).not.toContain('workshop-loading')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('gates workflow data and mounts the shared controls when enabled', async () => {
    const slug = 'workflows/change-material'
    const page = await prepareModelPage(slug)
    respondToFetch('/models/workflows/change-material/page.json', () =>
      Response.json(page)
    )
    enabled.value = true
    render(ModelsPage, {
      props: { slug },
      slots: { fallback: '<h1>Public Models</h1>' }
    })
    expect(
      await screen.findByRole('heading', { name: 'Public Models' })
    ).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
    workflowsEnabled.value = true
    expect(
      await screen.findByRole('heading', { name: 'Change a material' })
    ).toBeVisible()
    expect(fetch).toHaveBeenCalledWith(
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
      respondToFetch(CATALOGUE_URL, () => Response.json(workshopPages))
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
      respondToFetch(CATALOGUE_URL, () => Response.json(workshopModels))
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
        expect(fetch).toHaveBeenCalledExactlyOnceWith(CATALOGUE_URL)
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
      respondToFetch(CATALOGUE_URL, () => {
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

  it('gives the hub heading and the tabs to a category, and takes them back', async () => {
    const user = userEvent.setup()
    respondToFetch(CATALOGUE_URL, () => Response.json(workshopPages))
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
    expect(screen.getByTestId('catalogue-tabs')).toBeVisible()

    await user.click(screen.getByTestId('browse-all-end'))
    expect(headingWrapper()).toHaveClass('sr-only')
    // Hidden, not removed: the page still owns the only h1.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Models heading' })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('catalogue-tabs')).toBeNull()

    await user.click(screen.getByTestId('section-back'))
    expect(headingWrapper()).not.toHaveClass('sr-only')
    expect(screen.getByTestId('catalogue-tabs')).toBeVisible()
  })

  it('switches the loaded catalogue and heading without fetching its data again', async () => {
    respondToFetch(CATALOGUE_URL, () => Response.json(workshopPages))
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
    expect(fetch).toHaveBeenCalledExactlyOnceWith(CATALOGUE_URL)
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
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('keeps a workflow page behind its gate while the workshop flag is off', async () => {
    workflowsEnabled.value = true
    render(ModelsPage, {
      props: { slug: 'workflows/change-material' },
      slots: { fallback: '<h1>Public Models</h1>' }
    })
    expect(
      await screen.findByRole('heading', { name: 'Public Models' })
    ).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('adds workflows to a loaded catalogue when their flag answers late', async () => {
    respondToFetch(CATALOGUE_URL, () => Response.json(workshopPages))
    render(ModelsPage)
    expect(await screen.findByTestId('workshop-search')).toBeTruthy()
    expect(screen.queryByTestId('catalogue-tabs')).toBeNull()

    workflowsEnabled.value = true
    expect(await screen.findByTestId('catalogue-tabs')).toBeTruthy()
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
      respondToFetch(slug ? `/models/${slug}/page.json` : CATALOGUE_URL, () =>
        Response.json(slug ? modelPage : workshopModels)
      )
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
