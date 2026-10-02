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
} from '../../scripts/posthog'
import ModelsCatalogue from './ModelsCatalogue.vue'
import type { WorkshopModel } from '../../config/models-catalogue'

vi.mock(import('../../scripts/posthog'))

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

    it('offers a task for each use case it holds, naming the formats behind it', async () => {
      renderExplore()

      const tasks = await screen.findAllByTestId('explore-task')
      expect(
        tasks.map((task) => [
          within(task)
            .getByText(/images|video/i)
            .textContent.trim(),
          within(task)
            .getAllByTestId('explore-task-kind')
            .map((kind) => kind.textContent.trim())
        ])
      ).toEqual([
        ['Generate images', ['Model']],
        ['Edit images', ['Workflow']],
        ['Image to video', ['Workflow', 'Model']]
      ])
    })

    it('narrows the results to the task a visitor picks and links to it in the catalogue', async () => {
      const user = userEvent.setup()
      renderExplore()

      await user.click((await screen.findAllByTestId('explore-task'))[2])

      expect(screen.queryByTestId('explore-tasks')).toBeNull()
      expect(
        screen.getByRole('heading', { name: 'Image to video' })
      ).toBeVisible()
      expect(
        screen.getByRole('button', { name: 'Image to video' })
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

    it('narrows by a task chip and widens back with All', async () => {
      const user = userEvent.setup()
      renderExplore()
      const chips = within(await screen.findByRole('group', { name: 'Tasks' }))

      await user.click(chips.getByRole('button', { name: 'Edit images' }))

      expect(screen.getByRole('heading', { name: 'Edit images' })).toBeVisible()
      expect(resultNames()).toEqual([
        '/hub/models/?useCase=edit-images',
        '/hub/workflows/relight/'
      ])

      await user.click(chips.getByRole('button', { name: 'All' }))

      expect(screen.getByTestId('explore-tasks')).toBeVisible()
      expect(
        screen.getByRole('heading', { name: 'Popular right now' })
      ).toBeVisible()
    })

    it.for([
      { covers: 'an image over a video', withImage: true, media: 'IMG' },
      { covers: 'a video without an image', withImage: false, media: 'VIDEO' }
    ])('covers a task with $covers', async ({ withImage, media }) => {
      const withThumb = (
        name: string,
        thumbnail: WorkshopModel['thumbnail']
      ): WorkshopModel => ({
        ...entry(name, 'model', ['generate-images']),
        thumbnail
      })
      renderExplore([
        withThumb('moving', { url: '/clip.mp4', kind: 'video' }),
        ...(withImage
          ? [withThumb('still', { url: '/still.webp', kind: 'image' })]
          : [])
      ])

      const tile = await screen.findByTestId('explore-task')
      expect(within(tile).getByTestId('model-card-media').tagName).toBe(media)
    })

    it('says when nothing matches and clears back to everything', async () => {
      const user = userEvent.setup()
      renderExplore()

      await user.type(await screen.findByTestId('explore-search'), 'zzz')
      expect(screen.getByTestId('explore-empty')).toBeVisible()

      await user.click(screen.getByRole('button', { name: 'Clear search' }))

      expect(screen.getByTestId('explore-search')).toHaveValue('')
      expect(screen.getByTestId('explore-tasks')).toBeVisible()
      expect(
        screen.getByRole('heading', { name: 'Popular right now' })
      ).toBeVisible()
    })

    it.for([
      {
        apps: true,
        catalogue: 'apps, workflows and models',
        models: launchModels,
        doors: ['/hub/apps/', '/hub/workflows/', '/hub/models/']
      },
      {
        apps: false,
        catalogue: 'workflows and models',
        models: launchModels,
        doors: ['/hub/workflows/', '/hub/models/']
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

    it('shows only the doors when the catalogue is empty', async () => {
      renderExplore([])

      await screen.findByTestId('explore-doors')
      expect(screen.queryByTestId('explore-tasks')).toBeNull()
      expect(screen.queryByTestId('explore-results')).toBeNull()
    })
  })

  it('leads the apps page with a featured app and names what is coming', async () => {
    render(ModelsCatalogue, {
      props: { models: launchModels, section: 'apps' }
    })

    expect(await screen.findByTestId('app-featured')).toHaveAttribute(
      'href',
      '/hub/apps/cinematic-studio/'
    )
    expect(screen.getByTestId('app-coming-soon')).toHaveTextContent(
      /Virtual try-on.*Hand product swap.*Background removal.*Sprite sheet generator/
    )
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
      '/platform/router/',
      '/platform/comfy-api/',
      '/platform/',
      'https://platform.comfy.org/profile/api-keys?onboarding=router',
      'https://docs.comfy.org/development/comfy-router/quickstart#comfy-router-quickstart'
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
    expect(screen.queryByRole('button', { name: /Browse all apps/ })).toBeNull()
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
