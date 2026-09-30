import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref, nextTick } from 'vue'
import type { Ref } from 'vue'

import {
  captureWorkshopEvent,
  useWorkshopAppsEnabled,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopFlag
} from '../../scripts/posthog'
import ModelsCatalogue from './ModelsCatalogue.vue'
import type { WorkshopModel } from '../../config/models-catalogue'

vi.mock(import('../../scripts/posthog'))

let enabled: Ref<boolean>
let appsEnabled: Ref<boolean>
let reshootFlag: Ref<boolean>

beforeEach(() => {
  history.replaceState(null, '', '/models/')
  enabled = ref(false)
  appsEnabled = ref(true)
  reshootFlag = ref(true)
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(enabled))
  vi.mocked(useWorkshopAppsEnabled).mockReturnValue(readonly(appsEnabled))
  vi.mocked(useWorkshopFlag).mockImplementation((name) =>
    readonly(name === 'workshop-reshoot-app-enabled' ? reshootFlag : ref(false))
  )
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
  },
  {
    type: 'APP',
    appId: 'studio',
    slug: 'apps/cinematic-studio',
    name: 'Cinematic Studio',
    href: '/models/apps/cinematic-studio/',
    workflowCount: 0,
    capabilities: [],
    modality: 'image'
  },
  {
    type: 'APP',
    appId: 'reshoot',
    slug: 'apps/reshoot',
    flag: 'workshop-reshoot-app-enabled',
    name: 'Re-shoot a video',
    href: '/models/apps/reshoot/',
    workflowCount: 0,
    capabilities: [],
    modality: 'video'
  }
]

describe('ModelsCatalogue', () => {
  it.for([
    {
      locale: 'en',
      tab: 'models',
      subtitle:
        'Try the latest AI models with your own ideas, right in your browser.'
    },
    {
      locale: 'en',
      tab: 'workflows',
      subtitle:
        'Turn your ideas into finished results with multi-step workflows powered by AI models.'
    },
    {
      locale: 'en',
      tab: 'apps',
      subtitle:
        'Take on bigger ideas with apps that bring multiple workflows together.'
    },
    {
      locale: 'zh-CN',
      tab: 'models',
      subtitle: '用你自己的创意试用最新的 AI 模型，就在浏览器中。'
    },
    {
      locale: 'zh-CN',
      tab: 'workflows',
      subtitle: '用由 AI 模型驱动的多步骤工作流，把你的想法变成完成的作品。'
    },
    {
      locale: 'zh-CN',
      tab: 'apps',
      subtitle: '用把多个工作流组合在一起的应用，挑战更大的想法。'
    }
  ] as const)(
    'introduces the $tab tab in its own words ($locale)',
    async ({ locale, tab, subtitle }) => {
      render(ModelsCatalogue, {
        props: { models: launchModels, locale, catalogueTab: tab }
      })

      expect(await screen.findByTestId('workshop-hero')).toHaveTextContent(
        subtitle
      )
    }
  )

  it('separates workflow outcomes from Models and searches their supporting model names', async () => {
    const user = userEvent.setup()
    render(ModelsCatalogue, {
      props: { models: launchModels, catalogueTab: 'workflows' }
    })

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

  it('keeps the old workflow query link working', async () => {
    history.replaceState(null, '', '/models/?type=workflows')
    const user = userEvent.setup()
    render(ModelsCatalogue, { props: { models: launchModels } })
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Workflows' })).toHaveAttribute(
        'aria-current',
        'page'
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

  it.for([
    { tab: 'models', named: 'the models page' },
    { tab: 'workflows', named: 'the workflows page' },
    { tab: 'apps', named: 'the apps page' }
  ] as const)(
    'keeps the tabs beside the controls on $named',
    async ({ tab }) => {
      render(ModelsCatalogue, {
        props: { models: launchModels, catalogueTab: tab }
      })

      const controls = await screen.findByTestId('workshop-toolbar')
      expect(within(controls).getByTestId('catalogue-tabs')).toBeVisible()
      expect(
        within(screen.getByTestId('workshop-hero')).queryByTestId(
          'catalogue-tabs'
        )
      ).toBeNull()
    }
  )

  it.for([
    { tab: 'models', current: 'Models', path: '/hub/models/' },
    { tab: 'workflows', current: 'Workflows', path: '/hub/workflows/' },
    { tab: 'apps', current: 'Apps', path: '/hub/apps/' }
  ] as const)(
    'marks $tab current and links every tab to its own page',
    async ({ tab, current, path }) => {
      render(ModelsCatalogue, {
        props: { models: launchModels, catalogueTab: tab }
      })
      const tabs = await screen.findByTestId('catalogue-tabs')
      expect(within(tabs).getByRole('link', { name: current })).toHaveAttribute(
        'aria-current',
        'page'
      )
      expect(
        within(tabs)
          .getAllByRole('link')
          .map((link) => link.getAttribute('href'))
      ).toEqual(['/hub/models/', '/hub/workflows/', '/hub/apps/'])
      expect(within(tabs).getByRole('link', { name: current })).toHaveAttribute(
        'href',
        path
      )
    }
  )

  it('lists the catalogue apps in the Apps tab, each on its own page', async () => {
    render(ModelsCatalogue, {
      props: { models: launchModels, catalogueTab: 'apps' }
    })

    const shelf = await screen.findByTestId('app-shelf')
    expect(
      within(shelf)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
    ).toEqual(['/models/apps/cinematic-studio/', '/models/apps/reshoot/'])
    expect(
      within(screen.getByTestId('workshop-toolbar')).getByTestId(
        'catalogue-tabs'
      )
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: /Browse all apps/ })).toBeNull()
  })

  it('hides an app whose PostHog flag is off, and shows it once it turns on', async () => {
    reshootFlag.value = false
    render(ModelsCatalogue, {
      props: { models: launchModels, catalogueTab: 'apps' }
    })
    const hrefs = () =>
      within(screen.getByTestId('app-shelf'))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))

    await waitFor(() =>
      expect(hrefs()).toEqual(['/models/apps/cinematic-studio/'])
    )

    reshootFlag.value = true
    await waitFor(() =>
      expect(hrefs()).toEqual([
        '/models/apps/cinematic-studio/',
        '/models/apps/reshoot/'
      ])
    )
  })

  it.for([
    {
      name: 'apps off',
      apps: false,
      workflows: true,
      tabs: ['Models', 'Workflows']
    },
    {
      name: 'workflows off',
      apps: true,
      workflows: false,
      tabs: ['Models', 'Apps']
    },
    { name: 'both off', apps: false, workflows: false, tabs: [] }
  ])(
    'shows only the tabs a visitor can open: $name',
    ({ apps, workflows, tabs }) => {
      appsEnabled.value = apps
      const models = launchModels.filter(
        (model) =>
          workflows || model.routerId !== undefined || model.type === 'APP'
      )
      render(ModelsCatalogue, { props: { models } })

      expect(
        screen
          .queryAllByRole('link', { name: /^(Models|Workflows|Apps)$/ })
          .map((link) => link.textContent.trim())
      ).toEqual(tabs)
    }
  )

  describe('catalogue route access', () => {
    let settled: Ref<boolean>

    beforeEach(() => {
      settled = ref(false)
      vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(settled))
      vi.spyOn(location, 'replace').mockImplementation(() => {})
    })

    it.for([
      { tab: 'apps', models: launchModels },
      {
        tab: 'workflows',
        models: launchModels.filter((model) => model.type !== 'CLOUD')
      }
    ] as const)(
      'replaces an unavailable $tab route with Models only after flags settle',
      async ({ tab, models }) => {
        enabled.value = true
        appsEnabled.value = false
        render(ModelsCatalogue, { props: { models, catalogueTab: tab } })

        expect(await screen.findByTestId('workshop-loading')).toBeVisible()
        expect(screen.queryByRole('link', { name: /Image model/ })).toBeNull()
        expect(location.replace).not.toHaveBeenCalled()
        expect(captureWorkshopEvent).not.toHaveBeenCalled()

        settled.value = true
        await waitFor(() =>
          expect(location.replace).toHaveBeenCalledExactlyOnceWith(
            '/hub/models/'
          )
        )
        expect(captureWorkshopEvent).not.toHaveBeenCalled()
      }
    )

    it('keeps the requested catalogue when its flag grants access', async () => {
      appsEnabled.value = false
      render(ModelsCatalogue, {
        props: { models: launchModels, catalogueTab: 'apps' }
      })
      expect(await screen.findByTestId('workshop-loading')).toBeVisible()

      appsEnabled.value = true
      settled.value = true

      expect(await screen.findByTestId('app-shelf')).toBeVisible()
      expect(screen.queryByTestId('workshop-loading')).toBeNull()
      expect(location.replace).not.toHaveBeenCalled()
    })
  })

  it('opens all workflows with a count and returns to the use-case groups', async () => {
    history.replaceState(null, '', '/models/?type=workflows')
    const user = userEvent.setup()
    render(ModelsCatalogue, { props: { models: launchModels } })
    await screen.findByRole('heading', { name: 'Create product photos & ads' })
    await user.click(screen.getByTestId('browse-all-end'))
    expect(
      screen.getByRole('heading', { level: 2, name: 'All workflows 2' })
    ).toBeVisible()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
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
    await user.click(screen.getByTestId('browse-all-end'))
    expect(
      screen.getByRole('heading', { level: 2, name: 'All models 1' })
    ).toBeVisible()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByRole('link', { name: /Image model/ })).toBeVisible()
    expect(screen.queryByRole('link', { name: /Change a material/ })).toBeNull()
    expect(
      screen.queryByRole('link', { name: /Remove an image background/ })
    ).toBeNull()
  })

  it.for([
    { tab: 'models', modelCount: 1, pageType: 'model' },
    { tab: 'workflows', modelCount: 2, pageType: 'workflow' },
    { tab: 'apps', modelCount: 2, pageType: 'app' }
  ] as const)(
    'counts the $tab catalogue once as $pageType content',
    async ({ tab, modelCount, pageType }) => {
      enabled.value = true
      render(ModelsCatalogue, {
        props: { models: launchModels, catalogueTab: tab }
      })
      await waitFor(() =>
        expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
          name: 'catalogue_viewed',
          properties: { model_count: modelCount, page_type: pageType }
        })
      )
    }
  )

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
    await user.click(screen.getByTestId('browse-all-end'))

    expect(screen.queryByTestId('workshop-hero')).toBeNull()
  })
})
