import { useToastStore } from '@/platform/updates/common/toastStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { LayerEditorSession } from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'

import { useCompositorPsdDownload } from './useCompositorPsdDownload'

const { buildSessionPsdBlob, downloadBlob, loadCompositorSession } = vi.hoisted(
  () => ({
    buildSessionPsdBlob: vi.fn(async () => new Blob(['psd'])),
    downloadBlob: vi.fn(),
    loadCompositorSession: vi.fn().mockResolvedValue(0)
  })
)

vi.mock(
  import('@/renderer/extensions/compositor/composables/compositorSession'),
  () => ({
    loadCompositorSession
  })
)
vi.mock(
  import('@/renderer/extensions/layerEditor/composables/useLayerEditorExport'),
  () => ({
    buildSessionPsdBlob,
    psdExportFilename: () => 'comfyui-layers-test.psd'
  })
)
vi.mock(import('@/base/common/downloadUtil'), () => ({ downloadBlob }))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})
const apps: App[] = []

function renderPsdDownload(
  createSession?: () => LayerEditorSession
): ReturnType<typeof useCompositorPsdDownload> {
  let psdDownload: ReturnType<typeof useCompositorPsdDownload> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        psdDownload = useCompositorPsdDownload(createSession)
        return () => null
      }
    })
  )
  app.use(i18n)
  app.mount(document.createElement('div'))
  apps.push(app)
  if (!psdDownload) throw new Error('PSD download not initialized')
  return psdDownload
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
})

function makeSession(glOk = true) {
  return {
    glOk: ref(glOk),
    dispose: vi.fn()
  }
}

const node = { id: toNodeId(5) } as unknown as LGraphNode

beforeEach(() => {
  vi.mocked(useToastStore().add).mockImplementation(() => undefined)
})

describe('useCompositorPsdDownload', () => {
  beforeEach(() => {
    loadCompositorSession.mockResolvedValue(0)
    buildSessionPsdBlob.mockResolvedValue(new Blob(['psd']))
  })

  it('loads a throwaway session, downloads the psd, and disposes it', async () => {
    const session = makeSession()
    const { exporting, downloadPsd } = renderPsdDownload(
      () => session as unknown as LayerEditorSession
    )

    await downloadPsd(node)

    expect(loadCompositorSession).toHaveBeenCalledWith(
      session,
      node,
      expect.any(Function)
    )
    expect(downloadBlob).toHaveBeenCalledWith(
      'comfyui-layers-test.psd',
      expect.any(Blob)
    )
    expect(session.dispose).toHaveBeenCalledTimes(1)
    expect(exporting.value).toBe(false)
    expect(vi.mocked(useToastStore().add)).not.toHaveBeenCalled()
  })

  it('reports an error and still disposes when WebGL is unavailable', async () => {
    const session = makeSession(false)
    const { downloadPsd } = renderPsdDownload(
      () => session as unknown as LayerEditorSession
    )

    await downloadPsd(node)

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(vi.mocked(useToastStore().add)).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'layerEditor.webglUnavailable'
      })
    )
    expect(session.dispose).toHaveBeenCalledTimes(1)
  })

  it('refuses to export when some layers failed to load', async () => {
    loadCompositorSession.mockResolvedValueOnce(2)
    const session = makeSession()
    const { downloadPsd } = renderPsdDownload(
      () => session as unknown as LayerEditorSession
    )

    await downloadPsd(node)

    expect(buildSessionPsdBlob).not.toHaveBeenCalled()
    expect(downloadBlob).not.toHaveBeenCalled()
    expect(vi.mocked(useToastStore().add)).toHaveBeenCalledTimes(1)
    expect(session.dispose).toHaveBeenCalledTimes(1)
  })

  it('reports an error and disposes when export fails midway', async () => {
    buildSessionPsdBlob.mockRejectedValueOnce(new Error('boom'))
    const session = makeSession()
    const { exporting, downloadPsd } = renderPsdDownload(
      () => session as unknown as LayerEditorSession
    )

    await downloadPsd(node)

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(vi.mocked(useToastStore().add)).toHaveBeenCalledTimes(1)
    expect(session.dispose).toHaveBeenCalledTimes(1)
    expect(exporting.value).toBe(false)
  })

  it('recovers when session creation throws', async () => {
    const { exporting, downloadPsd } = renderPsdDownload(() => {
      throw new Error('boom')
    })

    await downloadPsd(node)

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(vi.mocked(useToastStore().add)).toHaveBeenCalledTimes(1)
    expect(exporting.value).toBe(false)
  })

  it('ignores clicks while an export is in flight', async () => {
    let resolveBlob!: (blob: Blob) => void
    buildSessionPsdBlob.mockImplementationOnce(
      () => new Promise<Blob>((resolve) => (resolveBlob = resolve))
    )
    const session = makeSession()
    const { downloadPsd } = renderPsdDownload(
      () => session as unknown as LayerEditorSession
    )

    const first = downloadPsd(node)
    await downloadPsd(node)
    expect(loadCompositorSession).toHaveBeenCalledTimes(1)

    resolveBlob(new Blob(['psd']))
    await first
    expect(downloadBlob).toHaveBeenCalledTimes(1)
  })
})
