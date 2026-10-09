import type { TestWorkflowDetail } from '@comfyorg/ingest-types/test-workflows'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createHash, webcrypto } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

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
    required_inputs: ['A test input'],
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
  return screen.findByRole('button', { name: /Unknown node original/ })
}

beforeEach(() => {
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
  it('browses unknown-node details without requesting original graphs or executing them', async () => {
    const user = userEvent.setup()
    renderLibrary()
    const entry = await chooseCollection(user)
    await user.click(entry)
    expect(await screen.findByText('UnknownCustomNode')).toBeVisible()
    expect(screen.getByText('Implementation is unknown')).toBeVisible()
    expect(screen.getByText('test-only')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'MagicPatch conversion' })
    ).toBeDisabled()
    expect(
      screen.getByText(messages.testWorkflowLibrary.converterUnavailable)
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

  it('paginates on demand and groups variants without loading the whole corpus', async () => {
    const user = userEvent.setup()
    renderLibrary()
    const entry = await chooseCollection(user)
    expect(
      screen.getAllByRole('button', { name: /Unknown node original/ })
    ).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('cursor=next-page-token'),
        expect.anything()
      )
    )
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
