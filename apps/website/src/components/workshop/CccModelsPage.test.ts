// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableMainFrameNavigation":true,"disableChildPageNavigation":true}}}
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick, readonly, ref } from 'vue'
import type { AppConfig } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { CatalogListPages } from '@/lib/cms/catalog-list'
import {
  loadAppCatalogue,
  loadWorkflowCatalogue
} from '@/lib/workshop/catalogue-components'
import {
  useWorkshopAppsEnabled,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopWorkflowsEnabled,
  useWorkshopAuthFlag
} from '@/scripts/posthog'
import CccModelsPage from './CccModelsPage.vue'
import { reportWorkshopRun } from '@/config/workshop-run-state'

vi.mock(import('@/scripts/posthog'))
vi.mock(import('@/lib/workshop/catalogue-components'), () => ({
  loadAppCatalogue: Object.assign(
    vi.fn<() => ReturnType<typeof loadAppCatalogue>>(
      () => new Promise<never>(() => {})
    ),
    { cache: new Map<unknown, ReturnType<typeof loadAppCatalogue>>() }
  ),
  loadWorkflowCatalogue: Object.assign(
    vi.fn<() => ReturnType<typeof loadWorkflowCatalogue>>(
      () => new Promise<never>(() => {})
    ),
    { cache: new Map<unknown, ReturnType<typeof loadWorkflowCatalogue>>() }
  )
}))

beforeEach(() => {
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopAppsEnabled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(ref(false)))
})

const models: WorkshopModel[] = [
  {
    routerId: 'selected-model',
    slug: 'selected-model',
    name: 'Selected model',
    href: '/hub/models/selected-model/',
    workflowCount: 0,
    capabilities: [],
    useCases: ['generate-images']
  },
  {
    type: 'CLOUD',
    workflowId: 'selected-workflow',
    slug: 'workflows/selected-workflow',
    name: 'Selected workflow',
    href: '/hub/workflows/selected-workflow/',
    workflowCount: 1,
    capabilities: [],
    category: 'cleanup'
  },
  {
    type: 'APP',
    appId: 'studio',
    slug: 'apps/selected-app',
    name: 'Selected app',
    href: '/hub/apps/selected-app/',
    workflowCount: 0,
    capabilities: []
  }
]

const pages: CatalogListPages = {
  models: {
    page: 1,
    pageSize: 24,
    total: 1,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false
  },
  workflows: {
    page: 3,
    pageSize: 24,
    total: 100,
    totalPages: 5,
    hasPrevious: true,
    hasNext: true
  },
  apps: {
    page: 1,
    pageSize: 24,
    total: 1,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false
  }
}

it('restores the Browse All grid when returning directly to a paginated workflow URL', () => {
  render(CccModelsPage, {
    props: {
      initialModels: models,
      initialCatalogAvailable: true,
      section: 'workflows',
      initialPages: pages,
      initialSearch: '?p=3'
    }
  })
  expect(screen.getByTestId('workflow-search-results')).toBeVisible()
  expect(screen.queryByTestId('browse-all-end')).toBeNull()
  expect(screen.getByTestId('catalog-next')).toHaveAttribute(
    'href',
    '/hub/workflows/?p=4'
  )
  expect(fetch).not.toHaveBeenCalled()
})

it('restores paginated grid state and filters on a persisted catalogue then resets on the root URL', async () => {
  const view = render(CccModelsPage, {
    props: {
      initialModels: models,
      initialCatalogAvailable: true,
      section: 'workflows',
      initialPages: pages,
      initialSearch: ''
    }
  })
  expect(screen.getByTestId('browse-all-end')).toBeVisible()
  await view.rerender({ initialSearch: '?p=3&q=Selected&category=cleanup' })
  expect(screen.getByTestId('workflow-search-results')).toBeVisible()
  expect(screen.queryByTestId('browse-all-end')).toBeNull()
  expect(screen.getByTestId('workshop-search')).toHaveValue('Selected')
  expect(screen.getByTestId('catalog-next')).toHaveAttribute(
    'href',
    '/hub/workflows/?p=4&q=Selected&category=cleanup'
  )
  await view.rerender({ initialSearch: '' })
  expect(screen.getByTestId('browse-all-end')).toBeVisible()
  expect(screen.getByTestId('workshop-search')).toHaveValue('')
  expect(fetch).not.toHaveBeenCalled()
})

it('does not change the legacy category layout for an unrelated page parameter', () => {
  render(CccModelsPage, {
    props: {
      initialModels: models,
      initialCatalogAvailable: true,
      section: 'workflows',
      initialSearch: '?p=3'
    }
  })
  expect(screen.getByTestId('browse-all-end')).toBeVisible()
  expect(screen.queryByTestId('workflow-search-results')).toBeNull()
})

it.for(['?p=0', '?p=-1', '?p=1.5', '?p=9007199254740992'])(
  'keeps category browsing for invalid pagination %s',
  (initialSearch) => {
    render(CccModelsPage, {
      props: {
        initialModels: models,
        initialCatalogAvailable: true,
        section: 'workflows',
        initialPages: pages,
        initialSearch
      }
    })
    expect(screen.getByTestId('browse-all-end')).toBeVisible()
    expect(screen.queryByTestId('workflow-search-results')).toBeNull()
  }
)

it('renders the supplied grid and the very first workflow/app click without asynchronous catalogue loaders', async () => {
  const fetchData = vi.fn<typeof fetch>()
  vi.mocked(fetch).mockImplementation(fetchData)
  render(CccModelsPage, {
    props: { initialModels: models, initialCatalogAvailable: true }
  })
  expect(screen.getByTestId('workshop-search')).toBeVisible()
  expect(screen.queryByTestId('models-loading')).toBeNull()
  const user = userEvent.setup()
  await user.click(screen.getByTestId('catalogue-tab-workflows'))
  expect(screen.getByTestId('workflow-catalogue')).toBeVisible()
  expect(screen.getByText('Selected workflow')).toBeVisible()
  await user.click(screen.getByTestId('catalogue-tab-apps'))
  expect(screen.getByTestId('apps-catalogue')).toBeVisible()
  expect(screen.getByText('Selected app')).toBeVisible()
  expect(loadWorkflowCatalogue).not.toHaveBeenCalled()
  expect(loadAppCatalogue).not.toHaveBeenCalled()
  expect(fetchData).not.toHaveBeenCalled()
})

it('uses authoritative fresh snapshot props without remounting the synchronous catalogue', async () => {
  const view = render(CccModelsPage, {
    props: { initialModels: models, initialCatalogAvailable: true }
  })
  const hero = screen.getByTestId('workshop-hero')
  await view.rerender({
    initialModels: models.map((model) => ({
      ...model,
      name: 'Fresh selected row'
    })),
    section: 'workflows'
  })
  expect(screen.getByTestId('workflow-catalogue')).toBeVisible()
  expect(screen.getByText('Fresh selected row')).toBeVisible()
  expect(screen.queryByText('Selected workflow')).toBeNull()
  expect(screen.getByTestId('workshop-hero')).toBe(hero)
})

it('forwards the fallback slot when the initial catalogue is unavailable and the section is denied', async () => {
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(false)))
  render(CccModelsPage, {
    props: { section: 'workflows' },
    slots: { fallback: '<h1>Public fallback</h1>' }
  })
  expect(
    await screen.findByRole('heading', { name: 'Public fallback' })
  ).toBeVisible()
  expect(screen.queryByText('Selected workflow')).toBeNull()
})

it('retains selected workflow content while Astro prepares the next page before swapping', async () => {
  render(CccModelsPage, {
    props: { initialModels: models, initialCatalogAvailable: true }
  })
  const user = userEvent.setup()
  await user.click(screen.getByTestId('catalogue-tab-workflows'))
  const workflow = screen.getByTestId('workflow-catalogue')
  document.dispatchEvent(
    Object.assign(new Event('astro:before-swap'), {
      from: new URL('https://demo.test/hub/models/'),
      to: new URL('https://demo.test/hub/workflows/')
    })
  )
  await nextTick()
  expect(screen.getByTestId('workflow-catalogue')).toBe(workflow)
  expect(screen.getByText('Selected workflow')).toBeVisible()
  expect(screen.queryByTestId('models-loading')).toBeNull()
})

it('keeps Astro transition attributes on the island boundary rather than passing them to the fragment page', async () => {
  const warnHandler = vi.fn<NonNullable<AppConfig['warnHandler']>>()
  const view = render(CccModelsPage, {
    props: { initialModels: models, initialCatalogAvailable: true },
    attrs: {
      'data-astro-transition-scope': 'ccc-scope',
      'data-astro-transition-persist': 'ccc-hub-catalogue-en'
    },
    global: { config: { warnHandler } }
  })
  await userEvent.setup().click(screen.getByTestId('catalogue-tab-workflows'))
  await view.rerender({ section: 'workflows', initialModels: [...models] })
  expect(screen.getByText('Selected workflow')).toBeVisible()
  expect(warnHandler).not.toHaveBeenCalled()
})

function changedPage(name: string) {
  return Response.json({
    models: [{ ...models[1], name }],
    pages,
    facets: {
      models: { useCases: [], sortOrders: ['popular'] },
      workflows: {
        categories: [{ value: 'cleanup', label: 'Cleanup' }],
        models: []
      }
    }
  })
}
function retainedPage() {
  history.replaceState(null, '', '/hub/workflows/?p=3&q=Selected')
  return render(CccModelsPage, {
    props: {
      initialModels: [models[1]],
      initialCatalogAvailable: true,
      section: 'workflows',
      initialPages: pages,
      initialSearch: '?p=3&q=Selected'
    },
    global: {
      stubs: {
        CatalogDetailPage: { template: '<div data-testid="isolated-detail" />' }
      }
    }
  })
}
function backToList() {
  history.replaceState(null, '', '/hub/workflows/?p=3&q=Selected')
  document.dispatchEvent(
    new CustomEvent('ccc:history', {
      detail: new PopStateEvent('popstate'),
      cancelable: true
    })
  )
}

it.for(['publish', 'revert'])(
  'revalidates the retained page on Back after %s instead of showing its old cards',
  async (operation) => {
    let finish: ((response: Response) => void) | undefined
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    vi.mocked(fetch).mockImplementation(fetcher)
    retainedPage()
    const original = screen.getByText('Selected workflow')
    await userEvent.setup().click(original)
    expect(screen.getByTestId('isolated-detail')).toBeVisible()
    backToList()
    await nextTick()
    expect(original).not.toBeVisible()
    expect(fetcher).toHaveBeenCalledOnce()
    const url = new URL(String(fetcher.mock.calls[0][0]))
    expect(url.pathname).toBe('/models/catalogue.json')
    expect(url.searchParams.get('format')).toBe('page')
    expect(url.searchParams.get('section')).toBe('workflows')
    expect(url.searchParams.get('p')).toBe('3')
    expect(url.searchParams.get('q')).toBe('Selected')
    finish?.(changedPage(`Selected workflow after ${operation}`))
    expect(
      await screen.findByText(`Selected workflow after ${operation}`)
    ).toBeVisible()
    expect(screen.queryByText('Selected workflow')).toBeNull()
    expect(screen.getByTestId('workshop-search')).toHaveValue('Selected')
  }
)

it('shows a refusal and retry instead of exposing retained cards when Back revalidation fails', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
  vi.mocked(fetch).mockImplementation(fetcher)
  retainedPage()
  await userEvent.setup().click(screen.getByText('Selected workflow'))
  backToList()
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.getByText('Selected workflow')).not.toBeVisible()
  fetcher.mockResolvedValueOnce(changedPage('Selected workflow recovered'))
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Selected workflow recovered')).toBeVisible()
})

it('refreshes after focus and persisted pageshow; a late older reply cannot restore stale cards', async () => {
  const pending: ((response: Response) => void)[] = []
  const fetcher = vi.fn<typeof fetch>(
    () => new Promise((resolve) => pending.push(resolve))
  )
  vi.mocked(fetch).mockImplementation(fetcher)
  retainedPage()
  window.dispatchEvent(new Event('focus'))
  await nextTick()
  window.dispatchEvent(
    Object.assign(new Event('pageshow'), { persisted: true })
  )
  await nextTick()
  expect(fetcher).toHaveBeenCalledTimes(2)
  pending[1](changedPage('Selected workflow current'))
  expect(await screen.findByText('Selected workflow current')).toBeVisible()
  pending[0](changedPage('Selected workflow obsolete'))
  await nextTick()
  expect(screen.queryByText('Selected workflow obsolete')).toBeNull()
  expect(screen.getByText('Selected workflow current')).toBeVisible()
})

it('does not replace an active run on focus or BFCache restoration', async () => {
  const fetcher = vi.fn<typeof fetch>()
  vi.mocked(fetch).mockImplementation(fetcher)
  retainedPage()
  reportWorkshopRun(() => undefined)
  try {
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(
      Object.assign(new Event('pageshow'), { persisted: true })
    )
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(fetcher).not.toHaveBeenCalled()
    expect(screen.getByText('Selected workflow')).toBeVisible()
  } finally {
    reportWorkshopRun(undefined)
  }
})
