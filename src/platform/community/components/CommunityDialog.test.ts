import type { CloudNodeRegistry } from '@comfyorg/ingest-types'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createHash, webcrypto } from 'node:crypto'
import { beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import messages from '@/locales/en/main.json'
import CommunityDialog from './CommunityDialog.vue'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  handleFile: vi.fn(),
  reload: vi.fn()
}))
vi.mock('@/scripts/api', () => ({ api: { fetchApi: mocks.fetch } }))
vi.mock('@/scripts/app', () => ({
  app: { handleFile: mocks.handleFile, reloadNodeDefs: mocks.reload }
}))
vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))
vi.mock('@/platform/customNodes/components/CustomNodePacksDialog.vue', () => ({
  default: { template: '<div />' }
}))
const scope = ref<string | null>('account/workspace')
vi.mock('@/platform/customNodes/composables/useNodeAccountScope', () => ({
  useNodeAccountScope: () => ({
    scope,
    capture: () => ({ scope: scope.value }),
    current: (request: { scope: string | null }) =>
      request.scope === scope.value
  })
}))

const raw =
  '{\r\n"nodes":[{"id":1,"type":"UnknownCustomNode"}],"links":[]\r\n}\r\n'
const hash = createHash('sha256').update(raw).digest('hex')
const entry = {
  workflow_sha256: hash,
  metadata_sha256: 'b'.repeat(64),
  name: 'Portrait original',
  description: 'An unsupported QA original',
  tags: ['portrait'],
  tasks: ['image'],
  node_types: ['UnknownCustomNode'],
  models: ['flux.safetensors'],
  packs: ['registry:example'],
  structural_cluster: 'one',
  node_count: 1,
  unresolved_pack_count: 1,
  verified: false
}
const catalog: CloudNodeRegistry = {
  corpus_commit: 'c'.repeat(40),
  pins: [],
  revisions: [
    {
      revision_id: 'd'.repeat(64),
      name: 'Example',
      pack_id: 'example/revision',
      upstream_commit: 'e'.repeat(40),
      source_sha256: 'f'.repeat(64),
      manifest_sha256: 'a'.repeat(64),
      dependency_profile_sha256: 'b'.repeat(64),
      nodes: ['ExampleNode'],
      node_api_version: 2,
      pinned: false,
      prepared: true,
      comfy_verified: false
    }
  ]
}

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  mocks.fetch.mockImplementation(async (route: string) => {
    if (route === '/customnodes/registry') return Response.json(catalog)
    if (route.endsWith('index.json')) return Response.json({ entries: [entry] })
    if (route.endsWith('workflow.json')) return new Response(raw)
    return Response.json({
      summary: entry,
      metadata: {
        schema_version: 1,
        workflow_sha256: hash,
        name: entry.name,
        description: entry.description,
        tags: entry.tags,
        tasks: entry.tasks,
        node_types: entry.node_types,
        packs: [
          {
            node_type: 'UnknownCustomNode',
            resolution: 'unknown',
            candidates: []
          }
        ],
        models: [],
        prompts: [],
        structural_cluster: 'one',
        required_inputs: [],
        readiness: { status: 'unsupported', notes: [] },
        provenance: { source: 'synthetic test', license: 'test-only' }
      }
    })
  })
  mocks.handleFile.mockResolvedValue(undefined)
})

it('switches between pack and workflow browsing, retains filters, and opens the selected original through the loader', async () => {
  const user = userEvent.setup()
  const close = vi.fn()
  render(CommunityDialog, {
    props: { onClose: close },
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
      ],
      directives: { tooltip: {} },
      stubs: {
        VirtualGrid: {
          props: ['items'],
          template:
            '<div><slot v-for="item in items" name="item" :item="item" /></div>'
        }
      }
    }
  })
  expect(
    await screen.findByRole('button', { name: 'View Example details' })
  ).toBeVisible()
  const packSearch = screen.getByRole('combobox', {
    name: messages.customNodePacks.registry.search
  })
  await user.type(packSearch, 'portrait')
  await user.click(screen.getByRole('tab', { name: 'Community workflows' }))
  await user.click(await screen.findByRole('button', { name: entry.name }))
  await user.click(
    await screen.findByRole('button', { name: 'Open original graph' })
  )
  await waitFor(() => expect(mocks.handleFile).toHaveBeenCalledOnce())
  const file: File = mocks.handleFile.mock.calls[0][0]
  expect(await file.text()).toBe(raw)
  expect(close).toHaveBeenCalledOnce()
  await user.click(screen.getByRole('tab', { name: 'Custom node packs' }))
  expect(
    screen.getByRole('combobox', {
      name: messages.customNodePacks.registry.search
    })
  ).toHaveValue('portrait')
})
