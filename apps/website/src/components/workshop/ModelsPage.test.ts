import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, readonly, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { workshopModels } from '../../config/workshop-browse-content'
import './ModelDetail.vue'
import './ModelsCatalogue.vue'
import { prepareModelPage } from '../../routes/models/model-page'
import { useWorkshopAuthFlag, useWorkshopEnabled } from '../../scripts/posthog'
import ModelsPage from './ModelsPage.vue'

vi.mock(import('../../scripts/posthog'))

// Every case runs as a visitor Workshop is switched off for: the page is
// public, so that visitor gets the same content and only the Run gate differs.
beforeEach(() => {
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(false)))
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(ref(false)))
})

const modelSlug = 'bfl--flux-2-max--generate-images'
const modelPage = await prepareModelPage(modelSlug)

describe('Models page entry', () => {
  it.for([undefined, modelSlug])(
    'server-renders the static slot and fetches nothing for %s',
    async (slug) => {
      const fetchData = vi.fn<typeof fetch>()
      vi.stubGlobal('fetch', fetchData)
      const html = await renderToString(
        createSSRApp({
          render: () =>
            h(ModelsPage, { slug }, { loading: () => h('h1', 'Every model') })
        })
      )
      expect(html).toContain('Every model')
      expect(html).not.toContain('workshop-search')
      expect(html).not.toContain('model-detail')
      expect(fetchData).not.toHaveBeenCalled()
    }
  )

  it('server-renders a compact frame when the page passes no slot', async () => {
    const html = await renderToString(
      createSSRApp({ render: () => h(ModelsPage, { slug: modelSlug }) })
    )
    expect(html).toContain('data-testid="models-loading"')
    expect(html).not.toContain('min-h-svh')
  })

  it.for([
    { slug: undefined, visible: 'workshop-search' },
    { slug: modelSlug, visible: 'model-detail' }
  ])(
    'replaces the static slot with $visible without Workshop being enabled',
    async ({ slug, visible }) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json(slug ? modelPage : workshopModels))
      )
      render(ModelsPage, {
        props: { slug },
        slots: { loading: '<h1>Every model</h1>' }
      })
      expect(screen.getByRole('heading', { name: 'Every model' })).toBeTruthy()
      expect(await screen.findByTestId(visible)).toBeTruthy()
      expect(screen.queryByRole('heading', { name: 'Every model' })).toBeNull()
    }
  )

  it('shows the playground with its Run button unavailable while Workshop is disabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(modelPage))
    )
    render(ModelsPage, { props: { slug: modelSlug } })
    const run = await screen.findByTestId('run-button')
    expect(run).toHaveAttribute('data-gate', 'unavailable')
    expect(run).toBeDisabled()
    expect(screen.getByTestId('playground-input')).toBeTruthy()
  })
})
