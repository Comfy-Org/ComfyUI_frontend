import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref, createSSRApp, h, nextTick } from 'vue'
import type { Ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { workshopModels } from '../../config/workshop-browse-content'
import { workshopPages } from '../../config/workshop-page-content'
import './ModelPage.vue'
import './ModelsCatalogue.vue'
import { prepareModelPage } from '../../routes/models/model-page'
import {
  useWorkshopAppsEnabled,
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopWorkflowsEnabled,
  useWorkshopAuthFlag
} from '../../scripts/posthog'
import ModelsPage from './ModelsPage.vue'

vi.mock(import('../../scripts/posthog'))

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

  it('adds workflows to a loaded catalogue when their flag answers late', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(workshopPages))
    )
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
