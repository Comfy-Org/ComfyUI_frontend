import { render, screen, within } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopWorkflowsEnabled,
  useWorkshopAuthFlag
} from '../../scripts/posthog'
import { FORWARD_GRACE_MS } from './forwardLegacySection'
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
          h(
            ModelsPage,
            { section: 'workflows' },
            { heading: () => h('h1', 'ComfyUI workflows') }
          )
      })
    )
    expect(html).toContain('<h1>ComfyUI workflows</h1>')
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
        props: { section },
        slots: {
          heading: '<h1>Section heading</h1>',
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
        render(ModelsPage)
        await vi.waitFor(() =>
          expect(useWorkshopEnabledSettled).toHaveBeenCalled()
        )
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
      render(ModelsPage)
      await vi.waitFor(() =>
        expect(useWorkshopEnabledSettled).toHaveBeenCalled()
      )

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
      const { unmount } = render(ModelsPage)
      await vi.waitFor(() =>
        expect(useWorkshopEnabledSettled).toHaveBeenCalled()
      )

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
