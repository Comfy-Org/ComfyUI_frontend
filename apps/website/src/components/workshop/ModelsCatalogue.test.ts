import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref, nextTick } from 'vue'
import type { Ref } from 'vue'

import { useWorkshopEnabled, captureWorkshopEvent } from '../../scripts/posthog'
import ModelsCatalogue from './ModelsCatalogue.vue'
import type { WorkshopModel } from '../../config/models-catalogue'

vi.mock(import('../../scripts/posthog'))

let enabled: Ref<boolean>

beforeEach(() => {
  history.replaceState(null, '', '/models/')
  enabled = ref(false)
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(enabled))
})

const launchModels: WorkshopModel[] = [
  {
    routerId: 'test/image-model',
    slug: 'test-image-model',
    name: 'Image model',
    href: '/models/test-image-model/',
    workflowCount: 0,
    capabilities: [],
    useCases: ['generate-images']
  },
  {
    type: 'CLOUD',
    workflowId: 'workflows/change-material',
    slug: 'workflows/change-material',
    name: 'Change a material',
    href: '/models/workflows/change-material/',
    workflowCount: 1,
    capabilities: [],
    category: 'product',
    categoryLabel: {
      en: 'Create product photos & ads',
      'zh-CN': '制作产品照片与广告'
    },
    models: ['Qwen Image Edit'],
    modality: 'image'
  },
  {
    type: 'CLOUD',
    workflowId: 'workflows/remove-background',
    slug: 'workflows/remove-background',
    name: 'Remove an image background',
    href: '/models/workflows/remove-background/',
    workflowCount: 1,
    capabilities: [],
    category: 'cleanup',
    categoryLabel: { en: 'Edit & clean up photos', 'zh-CN': '编辑与修整照片' },
    models: ['BiRefNet'],
    modality: 'image'
  }
]

describe('ModelsCatalogue', () => {
  it.for([
    {
      tab: 'Models',
      subtitle:
        'Try the latest AI models with your own ideas, right in your browser.'
    },
    {
      tab: 'Workflows',
      subtitle:
        'Turn your ideas into finished results with multi-step workflows powered by AI models.'
    },
    {
      tab: 'Apps',
      subtitle:
        'Take on bigger ideas with apps that bring multiple workflows together.'
    }
  ])('introduces the $tab tab in its own words', async ({ tab, subtitle }) => {
    const user = userEvent.setup()
    render(ModelsCatalogue, { props: { models: launchModels } })
    if (tab !== 'Models')
      await user.click(screen.getByRole('button', { name: tab }))

    expect(await screen.findByTestId('workshop-hero')).toHaveTextContent(
      subtitle
    )
  })

  it('separates workflow outcomes from Models and searches their supporting model names', async () => {
    const user = userEvent.setup()
    render(ModelsCatalogue, { props: { models: launchModels } })
    expect(screen.getByText('Image model')).toBeVisible()
    expect(screen.queryByText('Remove an image background')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Workflows' }))
    expect(screen.queryByText('Image model')).toBeNull()
    expect(
      await screen.findByRole('heading', {
        name: 'Create product photos & ads'
      })
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Edit & clean up photos' })
    ).toBeVisible()
    expect(screen.queryByText(/See all/)).toBeNull()

    await user.type(screen.getByRole('searchbox'), 'Qwen')
    expect(
      screen.getByRole('link', { name: /Change a material/ })
    ).toHaveAttribute('href', '/models/workflows/change-material/')
    expect(
      screen.queryByRole('link', { name: /Remove an image background/ })
    ).toBeNull()
  })

  it('opens the workflow tab from its return link and filters by its own categories', async () => {
    history.replaceState(null, '', '/models/?type=workflows')
    const user = userEvent.setup()
    render(ModelsCatalogue, { props: { models: launchModels } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Workflows' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    )
    await user.click(await screen.findByRole('button', { name: 'Filter' }))
    await user.click(
      await screen.findByRole('button', { name: 'Edit & clean up photos 1' })
    )
    expect(
      screen.getByRole('link', { name: /Remove an image background/ })
    ).toBeVisible()
    expect(screen.queryByRole('link', { name: /Change a material/ })).toBeNull()
  })

  // The tabs belong with the controls that act on the list, not with the
  // heading: they switch halves inside the catalogue rather than announce it.
  // Apps has no list of its own, so it carries them anyway or there is no way
  // back out of it.
  it.for([
    { tab: 'Models', named: 'the models half' },
    { tab: 'Workflows', named: 'the workflows half' },
    { tab: 'Apps', named: 'the apps half' }
  ])('keeps the tabs beside the controls in $named', async ({ tab }) => {
    const user = userEvent.setup()
    render(ModelsCatalogue, { props: { models: launchModels } })
    if (tab !== 'Models')
      await user.click(screen.getByRole('button', { name: tab }))

    const controls = await screen.findByTestId('workshop-toolbar')
    expect(within(controls).getByTestId('catalogue-tabs')).toBeVisible()
    expect(
      within(screen.getByTestId('workshop-hero')).queryByTestId(
        'catalogue-tabs'
      )
    ).toBeNull()
  })

  it.for([
    { from: 'models', to: 'workflows' },
    { from: 'workflows', to: 'apps' },
    { from: 'apps', to: 'models' }
  ])(
    'keeps keyboard focus on the tabs when switching from $from to $to',
    async ({ from, to }) => {
      const user = userEvent.setup()
      if (from !== 'models')
        history.replaceState(null, '', `/models/?type=${from}`)
      render(ModelsCatalogue, { props: { models: launchModels } })
      expect(document.body).toHaveFocus()

      const target = await screen.findByTestId(`catalogue-tab-${to}`)
      target.focus()
      await user.keyboard('{Enter}')

      await waitFor(() =>
        expect(screen.getByTestId(`catalogue-tab-${to}`)).toHaveFocus()
      )
      expect(screen.getByTestId(`catalogue-tab-${to}`)).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    }
  )

  it('keeps prototype app destinations out of the Apps tab', async () => {
    const user = userEvent.setup()
    render(ModelsCatalogue, { props: { models: launchModels } })
    await user.click(screen.getByRole('button', { name: 'Apps' }))
    expect(
      screen.getByRole('heading', { name: 'Apps are coming soon' })
    ).toBeVisible()
    expect(screen.queryByTestId('workshop-model-card')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('opens all workflows with a count and returns to the use-case groups', async () => {
    history.replaceState(null, '', '/models/?type=workflows')
    const user = userEvent.setup()
    render(ModelsCatalogue, { props: { models: launchModels } })
    await screen.findByRole('heading', { name: 'Create product photos & ads' })
    await user.click(screen.getByTestId('browse-all'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'All workflows 2'
    )
    expect(screen.queryByTestId('workshop-hero')).toBeNull()
    expect(screen.getByTestId('workflow-search-results')).toBeVisible()
    await user.click(screen.getByTestId('section-back'))
    expect(screen.getByTestId('workshop-hero')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Create product photos & ads' })
    ).toBeVisible()
  })

  it('keeps all models limited to models when workflows are available', async () => {
    const user = userEvent.setup()
    render(ModelsCatalogue, { props: { models: launchModels } })
    await user.click(screen.getByTestId('browse-all'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'All models 1'
    )
    expect(screen.getByRole('link', { name: /Image model/ })).toBeVisible()
    expect(screen.queryByRole('link', { name: /Change a material/ })).toBeNull()
    expect(
      screen.queryByRole('link', { name: /Remove an image background/ })
    ).toBeNull()
  })

  it('counts each visible catalogue once with its own content type', async () => {
    history.replaceState(null, '', '/models/?type=workflows')
    enabled.value = true
    const user = userEvent.setup()
    render(ModelsCatalogue, { props: { models: launchModels } })
    await screen.findByRole('heading', { name: 'Create product photos & ads' })
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'catalogue_viewed',
      properties: { model_count: 2, page_type: 'workflow' }
    })
    await user.click(screen.getByRole('button', { name: 'Models' }))
    await user.click(screen.getByRole('button', { name: 'Workflows' }))
    await screen.findByRole('heading', { name: 'Create product photos & ads' })
    expect(captureWorkshopEvent).toHaveBeenCalledTimes(2)
    expect(captureWorkshopEvent).toHaveBeenLastCalledWith({
      name: 'catalogue_viewed',
      properties: { model_count: 1, page_type: 'model' }
    })
  })

  it('records a visit once after access is enabled, without counting the hidden catalogue', async () => {
    render(ModelsCatalogue, { props: { models: [] } })
    await nextTick()
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
    enabled.value = true
    await nextTick()
    enabled.value = false
    await nextTick()
    enabled.value = true
    await nextTick()
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'catalogue_viewed',
      properties: { model_count: 0, page_type: 'model' }
    })
  })
  it.for(['?v=v2', '?version=v2', ''])(
    'ignores prototype overrides (%s) and renders the approved catalog',
    (query) => {
      history.replaceState(null, '', `/models/${query}`)
      localStorage.setItem('comfy-workshop-version', 'v2')
      render(ModelsCatalogue, { props: { models: [] } })
      expect(screen.getByTestId('workshop-hero')).toBeTruthy()
      expect(screen.queryByTestId('workshop-hub')).toBeNull()
      expect(screen.getByTestId('workshop-sections')).toBeTruthy()
    }
  )

  it('gives the hero away to the section the reader opened', async () => {
    const user = userEvent.setup()
    render(ModelsCatalogue, { props: { models: [] } })
    expect(screen.getByTestId('workshop-hero')).toBeTruthy()

    // Inside a section the page is about that section, and the heading over it
    // belongs to the whole catalogue.
    await user.click(screen.getByTestId('browse-all'))

    expect(screen.queryByTestId('workshop-hero')).toBeNull()
  })
})
