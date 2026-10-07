import type {
  CloudNodeRegistry,
  CloudNodeRegistryRevision
} from '@comfyorg/ingest-types'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { api } from '@/scripts/api'

import CloudNodeRegistryDialog from './CloudNodeRegistryDialog.vue'

vi.mock('@/scripts/api', () => ({ api: { fetchApi: vi.fn() } }))
vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))
const fetchApi = vi.mocked(api.fetchApi)
const ready: CloudNodeRegistryRevision = {
  revision_id: 'a'.repeat(64),
  name: 'Example',
  pack_id: 'example/x1234567',
  upstream_commit: 'b'.repeat(40),
  source_sha256: 'c'.repeat(64),
  manifest_sha256: 'd'.repeat(64),
  dependency_profile_sha256: 'e'.repeat(64),
  nodes: ['TestedNode', 'UntestedNode'],
  pinned: true,
  prepared: true,
  node_api_version: 2,
  comfy_verified: true,
  verification: {
    revision_id: 'a'.repeat(64),
    image_digest: '1'.repeat(64),
    tested_at: '2026-10-06T00:00:00Z',
    workflow_sha256: '2'.repeat(64),
    evidence_sha256: '3'.repeat(64),
    tested_nodes: ['TestedNode'],
    scope: 'workflow-smoke',
    scope_note:
      'Backend workflow smoke only. UI widgets, untested nodes and GPU isolation not verified.'
  }
}
const pending: CloudNodeRegistryRevision = {
  ...ready,
  revision_id: 'f'.repeat(64),
  source_sha256: '4'.repeat(64),
  pinned: false,
  prepared: false,
  comfy_verified: false,
  verification: null
}
const legacy: CloudNodeRegistryRevision = {
  ...pending,
  revision_id: '5'.repeat(64),
  name: 'Legacy',
  node_api_version: 1
}
const catalog: CloudNodeRegistry = {
  corpus_commit: '6'.repeat(40),
  pins: [ready.revision_id],
  revisions: [pending, ready, legacy]
}

function renderRegistry() {
  return render(CloudNodeRegistryDialog, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      directives: { tooltip: {} },
      stubs: {
        VirtualGrid: {
          props: ['items'],
          template:
            '<div><slot v-for="item in items" name="item" :item="item" /></div>'
        },
        BaseModalLayout: {
          props: ['rightPanelOpen'],
          template:
            '<div><header><slot name="leftPanelHeaderTitle" /><slot name="header" /></header><nav><slot name="leftPanel" /></nav><main><slot name="contentFilter" /><slot name="content" /></main><aside v-if="rightPanelOpen"><slot name="rightPanel" /></aside></div>'
        }
      }
    }
  })
}

describe('Cloud registry manager browsing', () => {
  beforeEach(() => {
    fetchApi.mockResolvedValue(Response.json(catalog))
  })

  it('opens pack details with the pinned version and exposes real-test coverage', async () => {
    const user = userEvent.setup()
    renderRegistry()
    await user.click(
      await screen.findByRole('button', { name: 'View Example details' })
    )
    expect(
      screen.getByText('1 of 2 node types executed in the recorded workflow')
    ).toBeVisible()
    expect(screen.getByText(ready.verification!.scope_note)).toBeVisible()
    expect(
      screen.getByRole('combobox', { name: 'Choose exact pack revision' })
    ).toHaveTextContent('conversion aaaaaaaaaaaa')
    expect(
      screen.getAllByRole('button', { name: 'Unpin Example' })
    ).toHaveLength(2)
    expect(fetchApi).toHaveBeenCalledWith('/customnodes/registry', {
      method: 'GET'
    })
  })

  it('selects a different conversion without inheriting verified status or installing it', async () => {
    const user = userEvent.setup()
    renderRegistry()
    await user.click(
      await screen.findByRole('button', { name: 'View Example details' })
    )
    await user.click(
      screen.getByRole('combobox', { name: 'Choose exact pack revision' })
    )
    await user.click(
      await screen.findByRole('option', { name: /conversion ffffffffffff/ })
    )
    expect(
      screen.queryByText('1 of 2 node types executed in the recorded workflow')
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(en.customNodePacks.registry.verificationMissing)
    ).toBeVisible()
    expect(fetchApi).toHaveBeenCalledTimes(1)
    fetchApi.mockResolvedValueOnce(
      Response.json({ error: 'conflicting revision' }, { status: 409 })
    )
    await user.click(screen.getByRole('button', { name: 'Pin Example' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('409')
    )
    expect(fetchApi.mock.calls[1]).toEqual([
      '/customnodes/registry/pins',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision_id: pending.revision_id, pinned: true })
      }
    ])
    expect(screen.getByRole('button', { name: 'Pin Example' })).toBeDisabled()
  })

  it('shows V1 conversion as deferred and never submits it for execution or installation', async () => {
    const user = userEvent.setup()
    renderRegistry()
    await user.click(
      await screen.findByRole('button', { name: 'View Legacy details' })
    )
    expect(
      screen.getByText(en.customNodePacks.registry.conversionDeferred)
    ).toBeVisible()
    for (const button of screen.getAllByRole('button', {
      name: 'Pin Legacy'
    })) {
      expect(button).toBeDisabled()
    }
    expect(fetchApi).toHaveBeenCalledTimes(1)
  })

  it('filters verified revisions and searches node names through the manager browser', async () => {
    const user = userEvent.setup()
    renderRegistry()
    await screen.findByRole('button', { name: 'View Legacy details' })
    await user.click(screen.getByRole('button', { name: 'Comfy Verified' }))
    expect(
      screen.queryByRole('button', { name: 'View Legacy details' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'View Example details' })
    ).toBeVisible()
    await user.type(
      screen.getByRole('combobox', {
        name: en.customNodePacks.registry.search
      }),
      'doesnotexist'
    )
    await screen.findByText(en.customNodePacks.registry.noMatches)
    expect(fetchApi).toHaveBeenCalledTimes(1)
  })
})
