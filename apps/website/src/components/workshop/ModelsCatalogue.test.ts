import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref, nextTick } from 'vue'
import type { Ref } from 'vue'

import {
  captureWorkshopEvent,
  useWorkshopAppsEnabled,
  useWorkshopEnabled,
  useWorkshopFlag
} from '@/scripts/posthog'
import ModelsCatalogue from './ModelsCatalogue.vue'
import { lastList } from '@/lib/workshop/shelf-memory'
import type { WorkshopModel } from '@/config/models-catalogue'

vi.mock(import('@/scripts/posthog'))

let enabled: Ref<boolean>
let reshootFlag: Ref<boolean>
let appsFlag: Ref<boolean>

beforeEach(() => {
  history.replaceState(null, '', '/models/')
  enabled = ref(false)
  reshootFlag = ref(true)
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(enabled))
  appsFlag = ref(false)
  vi.mocked(useWorkshopAppsEnabled).mockReturnValue(readonly(appsFlag))
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
    href: '/hub/apps/cinematic-studio/',
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
    href: '/hub/apps/reshoot/',
    workflowCount: 0,
    capabilities: [],
    modality: 'video'
  }
]

describe('ModelsCatalogue', () => {
  it.for([
    {
      locale: 'en',
      tab: 'explore',
      subtitle:
        'Start with an app, go deeper with a workflow, or build with a model.'
    },
    {
      locale: 'zh-CN',
      tab: 'explore',
      subtitle: '从应用开始，用工作流深入，或用模型来构建。'
    },
    {
      locale: 'en',
      tab: 'models',
      subtitle:
        'For developers: call the latest models through one API, try them here first or download open weights for ComfyUI.'
    },
    {
      locale: 'en',
      tab: 'workflows',
      subtitle: 'Download one or run it in Comfy Cloud, then change any step.'
    },
    {
      locale: 'en',
      tab: 'apps',
      subtitle: 'Ready-made tools, one job each. No nodes, no setup.'
    },
    {
      locale: 'zh-CN',
      tab: 'models',
      subtitle:
        '面向开发者：通过一个 API 调用最新模型，先在这里试用，或下载开放权重在 ComfyUI 中使用。'
    },
    {
      locale: 'zh-CN',
      tab: 'workflows',
      subtitle: '下载一个，或在 Comfy Cloud 中运行，然后修改任意步骤。'
    },
    {
      locale: 'zh-CN',
      tab: 'apps',
      subtitle: '现成的工具，一个只做一件事。无需节点，无需配置。'
    }
  ] as const)(
    'introduces the $tab section in its own words ($locale)',
    async ({ locale, tab, subtitle }) => {
      render(ModelsCatalogue, {
        props: { models: launchModels, locale, section: tab }
      })

      const hero = await screen.findByTestId(
        tab === 'models' ? 'models-hub-hero' : 'workshop-hero'
      )
      expect(within(hero).getByText(subtitle, { exact: false })).toBeVisible()
    }
  )

  it('keeps workflow outcomes out of the models section', () => {
    render(ModelsCatalogue, { props: { models: launchModels } })
    expect(screen.getByText('Image model')).toBeVisible()
    expect(screen.queryByText('Remove an image background')).toBeNull()
  })

  it('lists workflow outcomes in the workflows section and searches their supporting model names', async () => {
    const user = userEvent.setup()
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'workflows' }
    })
    expect(screen.queryByText('Image model')).toBeNull()
    expect(
      within(await screen.findByTestId('workflow-grid')).getByRole('link', {
        name: /Remove an image background/
      })
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

  it('filters the workflows section by its own categories', async () => {
    const user = userEvent.setup()
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'workflows' }
    })
    await user.click(await screen.findByRole('button', { name: 'Filter' }))
    await user.click(
      await screen.findByRole('button', { name: 'Edit & clean up photos 1' })
    )
    expect(
      screen.getByRole('link', { name: /Remove an image background/ })
    ).toBeVisible()
    expect(screen.queryByRole('link', { name: /Change a material/ })).toBeNull()
  })

  describe('explore', () => {
    const entry = (
      name: string,
      kind: 'workflow' | 'model',
      useCases: WorkshopModel['useCases']
    ): WorkshopModel =>
      kind === 'workflow'
        ? {
            type: 'CLOUD',
            workflowId: `workflows/${name}`,
            slug: `workflows/${name}`,
            name,
            href: `/hub/workflows/${name}/`,
            workflowCount: 1,
            capabilities: [],
            useCases
          }
        : {
            routerId: `acme/${name}`,
            slug: name,
            name,
            href: `/hub/models/${name}/`,
            workflowCount: 0,
            capabilities: [],
            useCases
          }
    const catalogue = [
      entry('relight', 'workflow', ['edit-images']),
      entry('painter', 'model', ['generate-images']),
      entry('animator', 'model', ['animate-images']),
      entry('animate-still', 'workflow', ['animate-images'])
    ]
    const renderExplore = (models = catalogue) =>
      render(ModelsCatalogue, { props: { models, section: 'explore' } })
    const resultNames = () =>
      within(screen.getByTestId('explore-results'))
        .queryAllByRole('link')
        .map((link) => link.getAttribute('href'))

    it.for([
      { locale: 'en', placeholder: 'Try “relight”, “upscale” or a model name' },
      { locale: 'zh-CN', placeholder: '试试“relight”、“upscale”或模型名称' }
    ] as const)(
      'suggests tasks and model names in the search box ($locale)',
      async ({ locale, placeholder }) => {
        render(ModelsCatalogue, {
          props: { models: catalogue, locale, section: 'explore' }
        })

        expect(await screen.findByPlaceholderText(placeholder)).toBeVisible()
      }
    )

    it('sends a model opened from the Hub back to the Hub', async () => {
      history.replaceState(null, '', '/hub/')
      const user = userEvent.setup()
      renderExplore()
      const painter = within(await screen.findByTestId('explore-results'))
        .getAllByRole('link')
        .find((link) => link.getAttribute('href') === '/hub/models/painter/')
      if (!painter) throw new Error('painter is not listed')
      painter.addEventListener('click', (event) => event.preventDefault())

      await user.click(painter)

      expect(lastList('/hub/models/painter/')).toEqual({
        href: '/hub/',
        label: 'Hub'
      })
    })

    it('shows Popular right now across every format with no task chips', async () => {
      renderExplore()

      const popular = within(await screen.findByTestId('explore-results'))
      expect(
        popular.getByRole('heading', { name: 'Popular right now' })
      ).toBeVisible()
      expect(popular.queryByRole('group')).toBeNull()
      expect(popular.queryAllByRole('button')).toEqual([])
      expect(resultNames()).toHaveLength(4)
      expect(resultNames()).toEqual(
        expect.arrayContaining([
          '/hub/models/animator/',
          '/hub/models/painter/',
          '/hub/workflows/animate-still/',
          '/hub/workflows/relight/'
        ])
      )
    })

    it.for([
      {
        query: 'relight',
        kinds: ['workflow', 'app'],
        heading: 'Results for “relight”'
      },
      { query: 'studio', kinds: ['app'], heading: 'Results for “studio”' },
      {
        query: '',
        kinds: ['app', 'workflow', 'workflow', 'model', 'model'],
        heading: 'Popular right now'
      }
    ])(
      'tags every result with its format: "$query"',
      async ({ query, kinds, heading }) => {
        appsFlag.value = true
        reshootFlag.value = false
        const user = userEvent.setup()
        renderExplore([
          ...catalogue,
          ...launchModels.filter((m) => m.type === 'APP')
        ])

        const search = await screen.findByTestId('explore-search')
        if (query) await user.type(search, query)

        expect(screen.getByRole('heading', { name: heading })).toBeVisible()
        expect(
          screen.getAllByTestId('explore-kind').map((tag) => tag.dataset.kind)
        ).toEqual(kinds)
      }
    )

    it('fronts each door with real catalogue work', async () => {
      appsFlag.value = true
      renderExplore([
        {
          ...entry('nano', 'model', ['generate-images']),
          slug: 'vertexai--gemini-3-pro-image--generate-images',
          name: 'Nano Banana Pro',
          creditsPerRun: 6,
          thumbnail: { url: '/lake.png', kind: 'image' }
        },
        {
          ...entry('product-in-scene', 'workflow', ['edit-images']),
          slug: 'workflows/product-in-scene',
          thumbnail: { url: '/bottle.webp', kind: 'image' }
        },
        {
          type: 'APP',
          appId: 'studio',
          slug: 'apps/cinematic-studio',
          name: 'Cinematic Studio',
          href: '/hub/apps/cinematic-studio/',
          workflowCount: 0,
          capabilities: []
        }
      ])

      const doors = await screen.findByTestId('explore-doors')
      expect(
        within(doors)
          .getAllByTestId('explore-door-art')
          .map((art) => within(art).getAllByAltText('')[0].getAttribute('src'))
      ).toEqual([
        '/lake.png',
        '/bottle.webp',
        '/images/cinematic-studio/neon-street.jpg'
      ])
      const model = within(screen.getByTestId('explore-door-models'))
      expect(model.getByText('Nano Banana Pro')).toBeInTheDocument()
      expect(model.getByText('Alpine lake at blue hour')).toBeInTheDocument()
    })

    it('says when nothing matches and clears back to everything', async () => {
      const user = userEvent.setup()
      renderExplore()

      await user.type(await screen.findByTestId('explore-search'), 'zzz')
      expect(screen.getByTestId('explore-empty')).toBeVisible()
      expect(screen.queryByTestId('explore-doors')).not.toBeInTheDocument()
      expect(screen.queryByTestId('explore-community')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Clear search' }))

      expect(screen.getByTestId('explore-search')).toHaveValue('')
      expect(screen.getByTestId('explore-doors')).toBeVisible()
      expect(screen.getByTestId('explore-community')).toBeVisible()
      expect(
        screen.getByRole('heading', { name: 'Popular right now' })
      ).toBeVisible()
    })

    it.for([
      {
        apps: true,
        catalogue: 'apps, workflows and models',
        models: launchModels,
        doors: ['/hub/models/', '/hub/workflows/', '/hub/apps/']
      },
      {
        apps: false,
        catalogue: 'workflows and models',
        models: launchModels,
        doors: ['/hub/models/', '/hub/workflows/']
      },
      {
        apps: false,
        catalogue: 'models only',
        models: launchModels.filter((model) => model.routerId),
        doors: ['/hub/models/']
      }
    ])(
      'ends with a door per format it holds: $catalogue',
      async ({ apps, models, doors }) => {
        appsFlag.value = apps
        renderExplore(models)

        expect(
          within(await screen.findByTestId('explore-doors'))
            .getAllByRole('link')
            .map((link) => link.getAttribute('href'))
        ).toEqual(doors)
      }
    )

    it('closes on work from the community, leading to the gallery and to sharing', async () => {
      renderExplore()

      const community = within(await screen.findByTestId('explore-community'))
      expect(community.getAllByTestId('explore-community-post')).toHaveLength(
        16
      )
      expect(
        community
          .getByRole('link', { name: 'Explore the gallery' })
          .getAttribute('href')
      ).toBe('/gallery/')
      expect(
        community.getByRole('link', { name: 'Share yours' })
      ).toHaveAttribute(
        'href',
        expect.stringMatching(/^https:\/\/docs\.google\.com\/forms\//)
      )
    })

    it('shows only the doors when the catalogue is empty', async () => {
      renderExplore([])

      await screen.findByTestId('explore-doors')
      expect(screen.queryByTestId('explore-results')).toBeNull()
    })
  })

  it('lists the open apps, then every app still being built', async () => {
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'apps' }
    })

    expect(
      within(await screen.findByTestId('app-grid'))
        .getAllByTestId('workshop-app-card')
        .map((card) => [
          within(card).getByTestId('app-card-name').textContent.trim(),
          card.getAttribute('href')
        ])
    ).toEqual([
      ['Cinematic Studio', '/hub/apps/cinematic-studio/'],
      ['Re-shoot a video', '/hub/apps/reshoot/'],
      ['Move anything', null],
      ['Relight', null],
      ['Hand product swap', null],
      ['Background Removal', null],
      ['Virtual try-on', null],
      ['Sprite Sheet Generator', null],
      ['Paparazzi me', null]
    ])
    expect(screen.queryByTestId('browse-all-end')).toBeNull()
  })

  it('opens the models page with an API key link and the API docs', async () => {
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'models' }
    })

    expect(
      within(await screen.findByTestId('models-hub-hero'))
        .getByRole('link', { name: 'Get an API key' })
        .getAttribute('href')
    ).toBe('https://platform.comfy.org/profile/api-keys?onboarding=router')
    expect(
      within(screen.getByTestId('model-access-partner'))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
    ).toEqual([
      'https://platform.comfy.org/profile/api-keys?onboarding=router',
      'https://docs.comfy.org/development/comfy-router/quickstart#comfy-router-quickstart'
    ])
    expect(screen.queryByTestId('workshop-hero')).toBeNull()
  })

  it('keeps the models hero off the workflows page', async () => {
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'workflows' }
    })

    await screen.findByTestId('workflow-catalogue')
    expect(screen.queryByTestId('models-hub-hero')).toBeNull()
    expect(screen.queryByTestId('model-access')).toBeNull()
  })

  it('lists the catalogue apps in the apps section, each on its own page', async () => {
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'apps' }
    })

    const shelf = await screen.findByTestId('app-grid')
    expect(
      within(shelf)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
    ).toEqual(['/hub/apps/cinematic-studio/', '/hub/apps/reshoot/'])
  })

  it('hides an app whose PostHog flag is off, and shows it once it turns on', async () => {
    reshootFlag.value = false
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'apps' }
    })
    const hrefs = () =>
      within(screen.getByTestId('app-grid'))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))

    await waitFor(() =>
      expect(hrefs()).toEqual(['/hub/apps/cinematic-studio/'])
    )

    reshootFlag.value = true
    await waitFor(() =>
      expect(hrefs()).toEqual([
        '/hub/apps/cinematic-studio/',
        '/hub/apps/reshoot/'
      ])
    )
  })

  it('lists the workflows in one grid with no rows to open', async () => {
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'workflows' }
    })
    await screen.findByTestId('workflow-grid')
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    expect(screen.queryByTestId('browse-all-end')).toBeNull()
    expect(screen.getByTestId('workshop-hero')).toBeVisible()
  })

  it('keeps all models limited to models when workflows are available', () => {
    render(ModelsCatalogue, { props: { models: launchModels } })
    expect(
      screen.getByRole('heading', { level: 2, name: /^All models \d+$/ })
    ).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Image model/ })).toBeVisible()
    expect(screen.queryByRole('link', { name: /Change a material/ })).toBeNull()
    expect(
      screen.queryByRole('link', { name: /Remove an image background/ })
    ).toBeNull()
  })

  it.for([
    { section: 'models', properties: { model_count: 1, page_type: 'model' } },
    {
      section: 'workflows',
      properties: { model_count: 2, page_type: 'workflow' }
    },
    { section: 'apps', properties: { model_count: 2, page_type: 'app' } }
  ] as const)(
    'counts the $section catalogue once with its own content type',
    async ({ section, properties }) => {
      enabled.value = true
      render(ModelsCatalogue, { props: { models: launchModels, section } })
      await waitFor(() => expect(captureWorkshopEvent).toHaveBeenCalled())
      expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
        name: 'catalogue_viewed',
        properties
      })
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
      expect(screen.getByTestId('models-hub-hero')).toBeTruthy()
      expect(screen.queryByTestId('workshop-hub')).toBeNull()
      expect(screen.getByTestId('workshop-toolbar')).toBeTruthy()
    }
  )

  it('keeps the hero over the models while a filter or a search narrows them', async () => {
    const user = userEvent.setup()
    const { emitted } = render(ModelsCatalogue, {
      props: { models: launchModels }
    })
    expect(screen.getByTestId('models-hub-hero')).toBeTruthy()
    expect(emitted().hero).toEqual([[true]])

    const field = screen.getByRole('searchbox', {
      name: 'Search models, providers, and categories'
    })
    await waitFor(() => expect(field).not.toHaveProperty('disabled', true))
    await user.type(field, 'image')

    expect(screen.getByTestId('models-hub-hero')).toBeTruthy()
    expect(screen.queryByTestId('workshop-hero')).toBeNull()
    expect(emitted().hero).toEqual([[true]])
  })

  it.for(['workflows', 'apps'] as const)(
    'leaves the plain heading to the %s page',
    (section) => {
      const { emitted } = render(ModelsCatalogue, {
        props: { models: launchModels, section }
      })
      expect(emitted().hero).toEqual([[false]])
    }
  )
})
