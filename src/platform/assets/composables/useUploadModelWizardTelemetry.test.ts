import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, ref } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { useUploadModelWizard } from './useUploadModelWizard'

const mockTrackByomFunnel = vi.hoisted(() => vi.fn())

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackByomFunnel: mockTrackByomFunnel })
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetMetadata: vi.fn(),
    uploadAssetAsync: vi.fn(),
    uploadAssetFromBase64: vi.fn()
  }
}))

vi.mock('@/platform/assets/importSources/civitaiImportSource', () => ({
  civitaiImportSource: {
    name: 'Civitai',
    type: 'civitai',
    hostnames: ['civitai.com'],
    fetchMetadata: vi.fn()
  }
}))

vi.mock('@/platform/assets/importSources/huggingfaceImportSource', () => ({
  huggingfaceImportSource: {
    name: 'HuggingFace',
    type: 'huggingface',
    hostnames: ['huggingface.co'],
    fetchMetadata: vi.fn()
  }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    addEventListener: vi.fn(),
    apiURL: vi.fn((path: string) => path),
    getServerFeature: vi.fn(
      (_name: string, defaultValue?: unknown) => defaultValue
    )
  }
}))

vi.mock('@/i18n', () => ({
  st: (_key: string, fallback: string) => fallback,
  t: (key: string) => key,
  te: () => false,
  d: (date: Date) => date.toISOString()
}))

/** Stage names in the order they were emitted. */
function emittedStages(): string[] {
  return mockTrackByomFunnel.mock.calls.map(([stage]) => stage as string)
}

/** Metadata of the first call for a given stage. */
function metadataFor(stage: string): Record<string, unknown> | undefined {
  return mockTrackByomFunnel.mock.calls.find(([s]) => s === stage)?.[1] as
    | Record<string, unknown>
    | undefined
}

describe('useUploadModelWizard telemetry', () => {
  const modelTypes = ref([{ name: 'Checkpoint', value: 'checkpoints' }])
  const mountedApps: App<Element>[] = []

  function setup(options: Parameters<typeof useUploadModelWizard>[1] = {}) {
    let result!: ReturnType<typeof useUploadModelWizard>
    const app = createApp({
      setup() {
        result = useUploadModelWizard(modelTypes, options)
        return () => null
      }
    })
    app.use(
      createI18n({
        legacy: false,
        locale: 'en',
        messages: { en: enMessages }
      })
    )
    app.mount(document.createElement('div'))
    mountedApps.push(app)
    return { result, app }
  }

  // Unmount in afterEach, never beforeEach: teardown emits dialog_abandoned, so
  // unmounting after the mock has been cleared would leak the previous test's
  // abandon event into the next test's assertions.
  afterEach(() => {
    while (mountedApps.length) mountedApps.pop()?.unmount()
  })

  beforeEach(() => {
    mockTrackByomFunnel.mockClear()
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('emits url_submitted with the resolved source, never the URL', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.getAssetMetadata).mockResolvedValue({
      filename: 'model.safetensors'
    } as never)

    const { result } = setup({ byomFlowId: 'flow-1' })
    result.wizardData.value.url = 'https://civitai.com/models/123?token=SECRET'
    await result.fetchMetadata()

    const submitted = metadataFor('url_submitted')
    expect(submitted).toMatchObject({
      flow_id: 'flow-1',
      surface: 'asset_browser',
      source: 'civitai'
    })
    // The URL can carry tokens or private-repo paths — it must never be sent.
    expect(JSON.stringify(mockTrackByomFunnel.mock.calls)).not.toContain(
      'SECRET'
    )
  })

  it('does not emit telemetry for a URL that never resolves to a supported source', async () => {
    const { result } = setup()
    result.wizardData.value.url = 'https://example.com/model.safetensors'
    await result.fetchMetadata()

    // canFetchMetadata gates the call, so nothing is emitted for a host that
    // never resolves to a source.
    expect(emittedStages()).not.toContain('url_submitted')
  })

  it('reports metadata failure without leaking the raw error message', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.getAssetMetadata).mockRejectedValue(
      new Error('404 fetching https://huggingface.co/private/repo?hf_token=XYZ')
    )

    const { result } = setup()
    result.wizardData.value.url = 'https://huggingface.co/private/repo'
    await result.fetchMetadata()

    expect(metadataFor('metadata_resolved')).toMatchObject({
      source: 'huggingface',
      outcome: 'error',
      error_reason: 'metadata_fetch_failed'
    })
    expect(JSON.stringify(mockTrackByomFunnel.mock.calls)).not.toContain(
      'hf_token'
    )
  })

  it('flags an auto-detected model type on metadata_resolved', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.getAssetMetadata).mockResolvedValue({
      filename: 'model.safetensors',
      tags: ['checkpoints']
    } as never)

    const { result } = setup()
    result.wizardData.value.url = 'https://civitai.com/models/123'
    await result.fetchMetadata()

    expect(metadataFor('metadata_resolved')).toMatchObject({
      outcome: 'success',
      model_type_autodetected: true
    })
  })

  it('carries one flow_id across every stage of an attempt', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.getAssetMetadata).mockResolvedValue({
      filename: 'model.safetensors'
    } as never)

    const { result } = setup({
      byomFlowId: 'flow-abc',
      byomSurface: 'missing_model'
    })
    result.wizardData.value.url = 'https://civitai.com/models/123'
    await result.fetchMetadata()

    const flowIds = mockTrackByomFunnel.mock.calls.map(
      ([, meta]) => (meta as { flow_id: string }).flow_id
    )
    expect(flowIds.length).toBeGreaterThan(0)
    expect(new Set(flowIds)).toEqual(new Set(['flow-abc']))
    expect(metadataFor('url_submitted')).toMatchObject({
      surface: 'missing_model'
    })
  })

  it('reports dialog_abandoned on teardown when no terminal stage fired', () => {
    const { app } = setup({ byomFlowId: 'flow-drop' })

    app.unmount()
    mountedApps.pop()

    expect(metadataFor('dialog_abandoned')).toMatchObject({
      flow_id: 'flow-drop',
      last_step: 1
    })
  })

  it('does not report abandon after a terminal stage', async () => {
    const { assetService } =
      await import('@/platform/assets/services/assetService')
    vi.mocked(assetService.getAssetMetadata).mockResolvedValue({
      filename: 'model.safetensors',
      tags: ['checkpoints']
    } as never)
    vi.mocked(assetService.uploadAssetAsync).mockResolvedValue({
      type: 'sync',
      asset: { id: 'a1', name: 'model.safetensors', tags: [] }
    } as never)

    const { result, app } = setup()
    result.wizardData.value.url = 'https://civitai.com/models/123'
    await result.fetchMetadata()
    await result.uploadModel()

    expect(metadataFor('upload_completed')).toMatchObject({
      mode: 'sync',
      outcome: 'success'
    })

    app.unmount()
    mountedApps.pop()

    // A completed flow must not also be counted as a drop-off.
    expect(emittedStages()).not.toContain('dialog_abandoned')
  })
})
