import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { LayerEditorSession } from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'

import { useCompositorPsdDownload } from './useCompositorPsdDownload'

const { buildSessionPsdBlob, downloadBlob, loadCompositorSession, toastAdd } =
  vi.hoisted(() => ({
    buildSessionPsdBlob: vi.fn(async () => new Blob(['psd'])),
    downloadBlob: vi.fn(),
    loadCompositorSession: vi.fn().mockResolvedValue(0),
    toastAdd: vi.fn()
  }))

vi.mock(
  '@/renderer/extensions/compositor/composables/compositorSession',
  () => ({
    loadCompositorSession
  })
)
vi.mock(
  '@/renderer/extensions/layerEditor/composables/useLayerEditorExport',
  () => ({
    buildSessionPsdBlob,
    psdExportFilename: () => 'comfyui-layers-test.psd'
  })
)
vi.mock('@/base/common/downloadUtil', () => ({ downloadBlob }))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: toastAdd })
}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

function makeSession(glOk = true) {
  return {
    glOk: ref(glOk),
    dispose: vi.fn()
  }
}

const node = { id: toNodeId(5) } as unknown as LGraphNode

describe('useCompositorPsdDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadCompositorSession.mockResolvedValue(0)
    buildSessionPsdBlob.mockResolvedValue(new Blob(['psd']))
  })

  it('loads a throwaway session, downloads the psd, and disposes it', async () => {
    const session = makeSession()
    const { exporting, downloadPsd } = useCompositorPsdDownload(
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
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('reports an error and still disposes when WebGL is unavailable', async () => {
    const session = makeSession(false)
    const { downloadPsd } = useCompositorPsdDownload(
      () => session as unknown as LayerEditorSession
    )

    await downloadPsd(node)

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledWith(
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
    const { downloadPsd } = useCompositorPsdDownload(
      () => session as unknown as LayerEditorSession
    )

    await downloadPsd(node)

    expect(buildSessionPsdBlob).not.toHaveBeenCalled()
    expect(downloadBlob).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(session.dispose).toHaveBeenCalledTimes(1)
  })

  it('reports an error and disposes when export fails midway', async () => {
    buildSessionPsdBlob.mockRejectedValueOnce(new Error('boom'))
    const session = makeSession()
    const { exporting, downloadPsd } = useCompositorPsdDownload(
      () => session as unknown as LayerEditorSession
    )

    await downloadPsd(node)

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(session.dispose).toHaveBeenCalledTimes(1)
    expect(exporting.value).toBe(false)
  })

  it('recovers when session creation throws', async () => {
    const { exporting, downloadPsd } = useCompositorPsdDownload(() => {
      throw new Error('boom')
    })

    await downloadPsd(node)

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(exporting.value).toBe(false)
  })

  it('ignores clicks while an export is in flight', async () => {
    let resolveBlob!: (blob: Blob) => void
    buildSessionPsdBlob.mockImplementationOnce(
      () => new Promise<Blob>((resolve) => (resolveBlob = resolve))
    )
    const session = makeSession()
    const { downloadPsd } = useCompositorPsdDownload(
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
