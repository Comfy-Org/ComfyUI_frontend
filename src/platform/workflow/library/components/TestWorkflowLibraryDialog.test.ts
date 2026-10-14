import type { TestWorkflowDetail } from '@comfyorg/ingest-types/test-workflows'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createHash, webcrypto } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { zTestWorkflowImportMetadata } from '@comfyorg/ingest-types/test-workflows/zod'
import cloudMetadata from '@/platform/community/fixtures/cloud-reference-v1/import.json'
import cloudOriginal from '@/platform/community/fixtures/cloud-reference-v1/workflow.json?raw'
import cloudAdapted from '@/platform/community/fixtures/cloud-reference-v1/workflow.cloud.json?raw'
import archiveDetail from '@/platform/workflow/library/fixtures/archive-only-detail.json'

import messages from '@/locales/en/main.json'
import TestWorkflowLibraryDialog from './TestWorkflowLibraryDialog.vue'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  handleFile: vi.fn(),
  report: vi.fn()
}))
vi.mock('@/scripts/api', () => ({ api: { fetchApi: mocks.fetch } }))
vi.mock('@/scripts/app', () => ({ app: { handleFile: mocks.handleFile } }))
vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mocks.report
}))
const scope = ref<string | null>('fixture-account/fixture-workspace')
vi.mock('@/platform/customNodes/composables/useNodeAccountScope', () => ({
  useNodeAccountScope: () => ({
    scope,
    capture: () => ({ scope: scope.value }),
    current: (request: { scope: string | null }) =>
      request.scope !== null && request.scope === scope.value
  })
}))

const raw =
  '{\r\n"nodes":[{"id":1,"type":"UnknownCustomNode"}],"links":[]\r\n}\r\n'
const hash = createHash('sha256').update(raw).digest('hex')
const detail: TestWorkflowDetail = {
  summary: {
    workflow_sha256: hash,
    metadata_sha256: 'a'.repeat(64),
    name: 'Unknown node original',
    description: 'Unsupported fixture, not an execution pass',
    tags: ['test'],
    tasks: ['image'],
    structural_cluster: 'cluster-one',
    node_count: 1,
    unresolved_pack_count: 1,
    verified: false
  },
  metadata: {
    schema_version: 1,
    workflow_sha256: hash,
    name: 'Unknown node original',
    description: 'Unsupported fixture, not an execution pass',
    tags: ['test'],
    tasks: ['image'],
    node_types: ['UnknownCustomNode'],
    packs: [
      { node_type: 'UnknownCustomNode', resolution: 'unknown', candidates: [] }
    ],
    models: [],
    prompts: [],
    structural_cluster: 'cluster-one',
    required_inputs: [
      {
        node_type: 'UnknownCustomNode',
        location: '/nodes/0',
        availability: 'unverified',
        recorded_widgets: ['A test input']
      }
    ],
    readiness: { status: 'unsupported', notes: ['Implementation is unknown'] },
    provenance: { source: 'synthetic fixture', license: 'test-only' }
  }
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

function renderLibrary() {
  return render(TestWorkflowLibraryDialog, {
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
      ]
    }
  })
}

async function chooseCollection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('combobox', { name: 'Collection' }))
  await user.click(
    await screen.findByRole('option', { name: 'corpus-pilot (120000)' })
  )
  return screen.findByRole('button', {
    name: 'Unknown node original'
  })
}

const observers: TestIntersectionObserver[] = []
class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = '256px'
  readonly scrollMargin = '0px'
  readonly thresholds = [0]
  target: Element | null = null
  constructor(private readonly callback: IntersectionObserverCallback) {
    observers.push(this)
  }
  observe(target: Element) {
    this.target = target
  }
  disconnect() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
  intersect() {
    if (!this.target) throw new Error('Expected an observed sentinel')
    this.callback(
      [
        {
          target: this.target,
          isIntersecting: true,
          intersectionRatio: 1,
          time: 0,
          boundingClientRect: new DOMRect(),
          intersectionRect: new DOMRect(),
          rootBounds: null
        }
      ],
      this
    )
  }
}

beforeEach(() => {
  observers.length = 0
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
  scope.value = 'fixture-account/fixture-workspace'
  vi.stubGlobal('crypto', webcrypto)
  mocks.fetch.mockImplementation(async (route: string) => {
    if (route.endsWith('/collections'))
      return response({
        collections: [{ id: 'corpus-pilot', count: 120000 }],
        truncated: false
      })
    if (route.includes('/facets'))
      return response({
        tags: ['', 'test'],
        tasks: ['image'],
        packs: [],
        models: [],
        partner_nodes: [],
        media_types: [],
        truncated: false
      })
    if (route.includes('include_workflow=true'))
      return response({ ...detail, workflow_json: raw })
    if (route.includes(`/entries/${hash}`)) return response(detail)
    return response({
      entries: [detail.summary],
      total: 120000,
      unresolved: 100000,
      verified: 0,
      next_cursor: 'next-page-token'
    })
  })
  mocks.handleFile.mockResolvedValue(undefined)
})

describe('Test workflow library UI', () => {
  it('combines exact corpus-backed model, pack, partner, media and graph-size filters and clears them', async () => {
    const baseline = mocks.fetch.getMockImplementation()
    mocks.fetch.mockImplementation((route: string, options: RequestInit) => {
      if (route.includes('/facets'))
        return response({
          tags: [],
          tasks: [],
          models: ['model & exact.safetensors'],
          packs: ['owner/pack'],
          partner_nodes: ['NativePartnerClass'],
          media_types: ['video'],
          truncated: false
        })
      return baseline?.(route, options)
    })
    const user = userEvent.setup()
    renderLibrary()
    await screen.findByRole('button', {
      name: 'Unknown node original'
    })
    for (const [label, value] of [
      ['Model name', 'model & exact.safetensors'],
      ['Node packs', 'owner/pack'],
      ['Partner/API nodes', 'NativePartnerClass'],
      ['Media type', 'Video'],
      ['Graph size', messages.testWorkflowLibrary.medium]
    ]) {
      await user.click(screen.getByRole('combobox', { name: label }))
      await user.click(await screen.findByRole('option', { name: value }))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
      )
    }
    const lastRoute: string = mocks.fetch.mock.lastCall?.[0]
    const query = new URL(lastRoute, 'https://fixture.invalid').searchParams
    expect(Object.fromEntries(query)).toMatchObject({
      model: 'model & exact.safetensors',
      pack: 'owner/pack',
      partner_node: 'NativePartnerClass',
      media_type: 'video',
      complexity: 'medium'
    })
    expect(query.has('cursor')).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenLastCalledWith(
        expect.stringMatching(/entries\?limit=24$/),
        expect.anything()
      )
    )
  })

  it('does not invent partner or media choices when the corpus has no classification index', async () => {
    renderLibrary()
    await screen.findByRole('button', {
      name: 'Unknown node original'
    })
    expect(
      screen.getByRole('combobox', { name: 'Partner/API nodes' })
    ).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Media type' })).toBeDisabled()
  })
  it('opens directly from a result and closes only after the normal loader finishes', async () => {
    const user = userEvent.setup()
    const result = renderLibrary()
    let finish: () => void = () => {}
    mocks.handleFile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    await user.click(
      await screen.findByRole('button', {
        name: 'Open Unknown node original'
      })
    )
    await waitFor(() => expect(mocks.handleFile).toHaveBeenCalledOnce())
    expect(result.emitted().close).toBeUndefined()
    expect(
      mocks.fetch.mock.calls.filter(([route]) =>
        String(route).includes(`/entries/${hash}`)
      )
    ).toHaveLength(1)
    const file: File = mocks.handleFile.mock.calls[0][0]
    expect(await file.text()).toBe(raw)
    finish()
    await waitFor(() => expect(result.emitted().close).toHaveLength(1))
  })

  it('appends on intersection, fills a short viewport, and stops at end without pagination controls', async () => {
    const user = userEvent.setup()
    renderLibrary()
    await chooseCollection(user)
    await waitFor(() => expect(observers.length).toBeGreaterThan(0))
    expect(
      screen.queryByRole('button', { name: 'Next page' })
    ).not.toBeInTheDocument()
    const second = {
      ...detail.summary,
      name: 'Second result',
      workflow_sha256: 'b'.repeat(64)
    }
    const third = {
      ...detail.summary,
      name: 'Third result',
      workflow_sha256: 'c'.repeat(64)
    }
    mocks.fetch.mockResolvedValueOnce(
      response({
        entries: [detail.summary, second],
        total: 3,
        unresolved: 3,
        verified: 0,
        next_cursor: 'last'
      })
    )
    const firstObserver = observers.at(-1)
    firstObserver?.intersect()
    await screen.findByRole('button', { name: 'Second result' })
    await waitFor(() => expect(observers.at(-1)).not.toBe(firstObserver))
    mocks.fetch.mockResolvedValueOnce(
      response({
        entries: [third],
        total: 3,
        unresolved: 3,
        verified: 0,
        next_cursor: ''
      })
    )
    observers.at(-1)?.intersect()
    await screen.findByRole('button', { name: 'Third result' })
    expect(
      screen.getAllByRole('button', {
        name: 'Unknown node original'
      })
    ).toHaveLength(1)
    expect(
      screen.getByText(messages.testWorkflowLibrary.endOfResults)
    ).toBeVisible()
    const count = mocks.fetch.mock.calls.length
    firstObserver?.intersect()
    await nextTick()
    expect(mocks.fetch.mock.calls).toHaveLength(count)
    expect(screen.queryByTestId('workflow-load-more')).not.toBeInTheDocument()
  })

  it('keeps loaded cards usable after an append failure and retries on request', async () => {
    renderLibrary()
    await screen.findByRole('button', {
      name: 'Unknown node original'
    })
    await waitFor(() => expect(observers.length).toBeGreaterThan(0))
    mocks.fetch.mockResolvedValueOnce(response({}, 503))
    observers.at(-1)?.intersect()
    expect(await screen.findByRole('alert')).toHaveTextContent('503')
    expect(
      screen.getByRole('button', {
        name: 'Open Unknown node original'
      })
    ).toBeEnabled()
    expect(screen.queryByTestId('workflow-load-more')).not.toBeInTheDocument()
    mocks.fetch.mockResolvedValueOnce(
      response({
        entries: [],
        total: 1,
        unresolved: 1,
        verified: 0,
        next_cursor: ''
      })
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText(messages.testWorkflowLibrary.endOfResults)
    expect(
      screen.getByRole('button', { name: 'Unknown node original' })
    ).toBeVisible()
  })
  it('shows archive-only detail without qualifying metadata and opens its exact original on request', async () => {
    const user = userEvent.setup()
    const archive = {
      ...archiveDetail,
      summary: { ...archiveDetail.summary, workflow_sha256: hash }
    }
    const baseline = mocks.fetch.getMockImplementation()
    mocks.fetch.mockImplementation((route: string) => {
      if (route.includes(`/entries/${hash}`))
        return response(
          route.includes('include_workflow=true')
            ? { ...archive, workflow_json: raw }
            : archive
        )
      if (route.includes('/entries?'))
        return response({
          entries: [archive.summary],
          total: 1,
          unresolved: 1,
          verified: 0,
          next_cursor: ''
        })
      return baseline?.(route)
    })
    renderLibrary()
    await user.click(
      await screen.findByRole('button', { name: archive.summary.name })
    )
    expect(
      await screen.findByRole('heading', { name: archive.summary.name })
    ).toBeVisible()
    expect(
      screen.getByText(messages.testWorkflowLibrary.archiveOnly)
    ).toBeVisible()
    expect(
      screen.getAllByText(messages.testWorkflowLibrary.notVerified).length
    ).toBeGreaterThan(0)
    expect(
      screen.queryByRole('button', {
        name: messages.community.openCloudAdapted
      })
    ).not.toBeInTheDocument()
    expect(mocks.handleFile).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', {
        name: messages.testWorkflowLibrary.openOriginal
      })
    )
    await waitFor(() => expect(mocks.handleFile).toHaveBeenCalledOnce())
    const file: File = mocks.handleFile.mock.calls[0][0]
    expect(await file.text()).toBe(raw)
  })

  it('keeps card selection alive after an explicit search with a pending input debounce', async () => {
    renderLibrary()
    const entry = await screen.findByRole('button', {
      name: 'Unknown node original'
    })
    const baseline = mocks.fetch.getMockImplementation()
    let resolveDetail: (value: Response) => void = () => {}
    const pendingDetail = new Promise<Response>((resolve) => {
      resolveDetail = resolve
    })
    let detailSignal: AbortSignal | undefined
    mocks.fetch.mockImplementation((route: string, options: RequestInit) => {
      if (route.includes(`/entries/${hash}`)) {
        detailSignal = options.signal ?? undefined
        return pendingDetail
      }
      return baseline?.(route, options)
    })
    vi.useFakeTimers()
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.type(
        screen.getByLabelText(messages.testWorkflowLibrary.search),
        'Unknown'
      )
      await user.click(screen.getByRole('button', { name: 'Search' }))
      await vi.advanceTimersByTimeAsync(0)
      await user.click(entry)
      expect(detailSignal).toBeDefined()
      await vi.advanceTimersByTimeAsync(300)
      expect(detailSignal?.aborted).toBe(false)
      expect(
        mocks.fetch.mock.calls.filter(([route]) =>
          String(route).includes('q=Unknown')
        )
      ).toHaveLength(1)
      resolveDetail(response(detail))
      await vi.advanceTimersByTimeAsync(0)
      await nextTick()
      expect(screen.getByText('UnknownCustomNode')).toBeVisible()
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers both graph choices without promoting reference adaptation to execution verification', async () => {
    const cloudRecord = {
      ...detail,
      summary: {
        ...detail.summary,
        workflow_sha256: cloudMetadata.workflow_sha256
      },
      metadata: zTestWorkflowImportMetadata.parse(cloudMetadata),
      community_cloud_adaptation_available: true
    }
    const baseline = mocks.fetch.getMockImplementation()
    mocks.fetch.mockImplementation(async (route: string) => {
      if (route.includes('include_workflow=true'))
        return response({
          ...cloudRecord,
          workflow_json: cloudOriginal,
          community_cloud_workflow_json: cloudAdapted
        })
      if (route.includes(`/entries/${cloudMetadata.workflow_sha256}`))
        return response(cloudRecord)
      if (route.includes('/entries?'))
        return response({
          entries: [cloudRecord.summary],
          total: 1,
          unresolved: 1,
          verified: 0,
          next_cursor: ''
        })
      return baseline?.(route)
    })
    const user = userEvent.setup()
    const result = renderLibrary()
    await user.click(await chooseCollection(user))
    expect(
      await screen.findByRole('button', { name: 'Open original graph' })
    ).toBeEnabled()
    for (const observation of screen.getAllByText('Execution not verified'))
      expect(observation).toBeVisible()
    expect(
      screen.getByText(messages.community.adaptationNotice)
    ).toBeInTheDocument()
    expect(mocks.handleFile).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Open Cloud-adapted graph' })
    )
    await waitFor(() => expect(mocks.handleFile).toHaveBeenCalledOnce())
    const file: File = mocks.handleFile.mock.calls[0][0]
    expect(await file.text()).toBe(cloudAdapted)
    await waitFor(() => expect(result.emitted().close).toHaveLength(1))
  })
  it('browses unknown-node details without requesting original graphs or executing them', async () => {
    const user = userEvent.setup()
    renderLibrary()
    const entry = await chooseCollection(user)
    await user.click(entry)
    expect(await screen.findByText('UnknownCustomNode')).toBeVisible()
    expect(screen.getByText('Implementation is unknown')).toBeVisible()
    expect(screen.getByText('UnknownCustomNode · unverified')).toBeVisible()
    expect(screen.getByText('/nodes/0')).toBeVisible()
    expect(screen.getByText('test-only')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'MagicPatch conversion' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(messages.testWorkflowLibrary.repairAfterOpen)
    ).toBeVisible()
    expect(mocks.handleFile).not.toHaveBeenCalled()
    expect(
      mocks.fetch.mock.calls.every(
        ([route]) => !String(route).includes('include_workflow=true')
      )
    ).toBe(true)
  })

  it('keeps an unsupported original openable and closes only after the normal loader completes', async () => {
    const user = userEvent.setup()
    const result = renderLibrary()
    await user.click(await chooseCollection(user))
    await user.click(
      await screen.findByRole('button', { name: 'Open original graph' })
    )
    await waitFor(() => expect(mocks.handleFile).toHaveBeenCalledOnce())
    const file: File = mocks.handleFile.mock.calls[0][0]
    expect(await file.text()).toBe(raw)
    await waitFor(() => expect(result.emitted().close).toHaveLength(1))
    expect(
      mocks.fetch.mock.calls.every(
        ([route]) => !String(route).includes('/prompt')
      )
    ).toBe(true)
  })

  it('groups structural variants without loading the whole corpus', async () => {
    const user = userEvent.setup()
    renderLibrary()
    const entry = await chooseCollection(user)
    expect(
      screen.getAllByRole('button', {
        name: 'Unknown node original'
      })
    ).toHaveLength(1)
    await user.click(entry)
    await user.click(
      await screen.findByRole('button', { name: 'Browse structural variants' })
    )
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('cluster=cluster-one'),
        expect.anything()
      )
    )
    expect(mocks.handleFile).not.toHaveBeenCalled()
  })

  it('shows an actionable failure without pretending an empty collection was imported', async () => {
    mocks.fetch.mockResolvedValue(response({}, 401))
    renderLibrary()
    expect(await screen.findByRole('alert')).toHaveTextContent('401')
    expect(
      screen.queryByText(messages.testWorkflowLibrary.empty)
    ).not.toBeInTheDocument()
    expect(mocks.handleFile).not.toHaveBeenCalled()
  })

  it('shows the first bounded page immediately when only one collection is available', async () => {
    renderLibrary()
    expect(
      await screen.findByRole('button', {
        name: 'Unknown node original'
      })
    ).toBeVisible()
    expect(mocks.handleFile).not.toHaveBeenCalled()
  })

  it('asks for a collection when multiple accessible collections are available', async () => {
    mocks.fetch.mockResolvedValueOnce(
      response({
        collections: [
          { id: 'corpus-pilot', count: 120000 },
          { id: 'personal-tests', count: 3 }
        ],
        truncated: false
      })
    )
    renderLibrary()
    expect(
      await screen.findByText(messages.testWorkflowLibrary.chooseCollection)
    ).toBeVisible()
    expect(mocks.fetch).toHaveBeenCalledOnce()
    expect(mocks.handleFile).not.toHaveBeenCalled()
  })

  it('keeps valid facets usable when a reference is unset', async () => {
    const user = userEvent.setup()
    renderLibrary()
    await chooseCollection(user)
    await user.click(screen.getByRole('combobox', { name: 'Tags' }))
    await user.click(await screen.findByRole('option', { name: 'test' }))
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('tag=test'),
        expect.anything()
      )
    )
    expect(mocks.handleFile).not.toHaveBeenCalled()
  })
})
