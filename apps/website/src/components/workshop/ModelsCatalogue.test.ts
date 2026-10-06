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
    'introduces the $tab section in its own words ($locale)',
    async ({ locale, tab, subtitle }) => {
      render(ModelsCatalogue, {
        props: { models: launchModels, locale, section: tab }
      })

      const hero = await screen.findByTestId('workshop-hero')
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

    const chips = () =>
      within(screen.getByTestId('explore-results')).getByRole('group', {
        name: 'Tasks'
      })

    it('offers a chip under Popular right now for each group of use cases it holds', async () => {
      renderExplore()

      const popular = within(await screen.findByTestId('explore-results'))
      expect(
        popular.getByRole('heading', { name: 'Popular right now' })
      ).toBeVisible()
      expect(
        within(chips())
          .getAllByRole('button')
          .map((chip) => chip.textContent.trim())
      ).toEqual(['All', 'Image', 'Video', 'Edit'])
    })

    it('narrows Popular to the use case a visitor picks and links to it in the catalogue', async () => {
      const user = userEvent.setup()
      renderExplore()
      await screen.findByTestId('explore-results')

      await user.click(within(chips()).getByRole('button', { name: 'Video' }))

      expect(
        screen.getByRole('heading', { name: 'Popular for video' })
      ).toBeVisible()
      expect(
        within(chips()).getByRole('button', { name: 'Video' })
      ).toHaveAttribute('aria-pressed', 'true')
      expect(resultNames()).toEqual([
        '/hub/models/?useCase=animate-images',
        '/hub/workflows/animate-still/',
        '/hub/models/animator/'
      ])
    })

    it.for([
      {
        query: 'relight',
        kinds: ['workflow'],
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

    it('narrows by a chip and widens back with All', async () => {
      const user = userEvent.setup()
      renderExplore()
      await screen.findByTestId('explore-results')

      await user.click(within(chips()).getByRole('button', { name: 'Edit' }))

      expect(
        screen.getByRole('heading', { name: 'Popular for edit' })
      ).toBeVisible()
      expect(resultNames()).toEqual([
        '/hub/models/?useCase=edit-images',
        '/hub/workflows/relight/'
      ])

      await user.click(within(chips()).getByRole('button', { name: 'All' }))

      expect(
        screen.getByRole('heading', { name: 'Popular right now' })
      ).toBeVisible()
      expect(
        within(chips()).getByRole('button', { name: 'All' })
      ).toHaveAttribute('aria-pressed', 'true')
    })

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
      expect(
        within(screen.getByTestId('explore-results')).queryByRole('group', {
          name: 'Tasks'
        })
      ).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Clear search' }))

      expect(screen.getByTestId('explore-search')).toHaveValue('')
      expect(chips()).toBeVisible()
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
      expect(screen.queryByRole('group', { name: 'Tasks' })).toBeNull()
      expect(screen.queryByTestId('explore-results')).toBeNull()
    })
  })

  it('leads the apps page with a featured app and lists the apps still being built', async () => {
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'apps' }
    })

    expect(await screen.findByTestId('app-featured')).toHaveAttribute(
      'href',
      '/hub/apps/cinematic-studio/'
    )
    expect(
      within(screen.getByTestId('app-shelf'))
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
      ['Sprite Sheet Generator', null]
    ])
    expect(screen.getByTestId('browse-all-end')).toBeVisible()
  })

  it('opens the models page with the API paths and a key link', async () => {
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'models' }
    })

    expect(
      within(await screen.findByTestId('build-api-band'))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
    ).toEqual([
      'https://platform.comfy.org/profile/api-keys?onboarding=router',
      'https://docs.comfy.org/development/comfy-router/quickstart#comfy-router-quickstart',
      '/platform/router/',
      '/platform/comfy-api/',
      '/platform/'
    ])
  })

  it('keeps the API paths off the workflows page', async () => {
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'workflows' }
    })

    await screen.findByTestId('workflow-catalogue')
    expect(screen.queryByTestId('build-api-band')).toBeNull()
  })

  it('lists the catalogue apps in the apps section, each on its own page', async () => {
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'apps' }
    })

    const shelf = await screen.findByTestId('app-shelf')
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
      within(screen.getByTestId('app-shelf'))
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

  it('opens all workflows with a count and returns to the use-case groups', async () => {
    const user = userEvent.setup()
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'workflows' }
    })
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
      screen.getByRole('heading', { level: 2, name: /^All models \d+$/ })
    ).toBeVisible()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
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
