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

  it.for([
    {
      apps: 'on',
      on: true,
      sections: [
        ['explore-use-cases', '/hub/workflows/'],
        ['explore-apps', '/hub/apps/'],
        ['explore-models', '/hub/models/']
      ]
    },
    {
      apps: 'off',
      on: false,
      sections: [
        ['explore-use-cases', '/hub/workflows/'],
        ['explore-models', '/hub/models/']
      ]
    }
  ])(
    'previews each space on the explore page with apps $apps',
    async ({ on, sections }) => {
      appsFlag.value = on
      render(ModelsCatalogue, {
        props: { models: launchModels, section: 'explore' }
      })
      const explore = await screen.findByTestId('explore-catalogue')
      const seeAll = /^(See all|Browse all)/

      expect(
        within(explore).getAllByRole('link', { name: seeAll })
      ).toHaveLength(sections.length)
      expect(
        sections.map(([section]) => [
          section,
          within(screen.getByTestId(section))
            .getByRole('link', { name: seeAll })
            .getAttribute('href')
        ])
      ).toEqual(sections)
    }
  )

  it('narrows the explore models to the provider a visitor picks', async () => {
    const user = userEvent.setup()
    const routerModel = (name: string, provider: string): WorkshopModel => ({
      routerId: `${provider}/${name}`,
      slug: name,
      name,
      provider,
      href: `/hub/models/${name}/`,
      workflowCount: 0,
      capabilities: [],
      useCases: ['generate-images']
    })
    render(ModelsCatalogue, {
      props: {
        models: [routerModel('alpha', 'Acme'), routerModel('beta', 'Zenith')],
        section: 'explore'
      }
    })
    const names = () =>
      within(screen.getByTestId('explore-models'))
        .getAllByTestId('model-card-name')
        .map((name) => name.textContent)

    await user.click(await screen.findByRole('button', { name: 'Zenith' }))

    expect(names()).toEqual(['beta'])
    expect(screen.getByRole('button', { name: 'Zenith' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
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
