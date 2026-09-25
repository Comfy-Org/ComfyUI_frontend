import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref, createSSRApp, h, nextTick } from 'vue'
import type { Ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { workshopModels } from '../../config/workshop-browse-content'
import './ModelPage.vue'
import './ModelsCatalogue.vue'
import { prepareModelPage } from '../../routes/models/model-page'
import {
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
    expect(screen.getByText('An example from this template.')).toBeVisible()
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
        expect(screen.getByTestId('related-models').textContent).toContain(
          'Browse all'
        )
        expect(
          within(screen.getByTestId('model-hero')).getByRole('link', {
            name: 'Generate images'
          })
        ).toHaveAttribute('href', '/models?useCase=generate-images')
      }
      enabled.value = !enabled.value
      await nextTick()
      expect(screen.getByTestId(visible)).toBeVisible()
    }
  )
})
