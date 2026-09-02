import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadBlob } from '@/base/common/downloadUtil'
import { loadCompositorSession } from '@/renderer/extensions/compositor/composables/compositorSession'
import {
  buildSessionPsdBlob,
  psdExportFilename
} from '@/renderer/extensions/layerEditor/composables/useLayerEditorExport'
import type { LayerEditorSession } from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import { useLayerEditorSession } from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'

export function useCompositorPsdDownload(
  createSession: () => LayerEditorSession = () => useLayerEditorSession()
) {
  const { t } = useI18n()
  const toastStore = useToastStore()
  const exporting = ref(false)

  async function downloadPsd(node: LGraphNode): Promise<void> {
    if (exporting.value) return
    exporting.value = true
    let session: LayerEditorSession | null = null
    try {
      session = createSession()
      if (!session.glOk.value) {
        console.error('[Compositor] WebGL compositor unavailable')
        toastStore.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('layerEditor.webglUnavailable')
        })
        return
      }
      const failed = await loadCompositorSession(session, node, (i) =>
        t('layerEditor.layerN', { n: i + 1 })
      )
      if (failed > 0) {
        console.error(`[Compositor] ${failed} layer(s) failed to load`)
        toastStore.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('layerEditor.exportPsdFailed')
        })
        return
      }
      const blob = await buildSessionPsdBlob(session)
      downloadBlob(psdExportFilename(new Date()), blob)
    } catch (err) {
      console.warn('[Compositor] PSD export failed', err)
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail:
          session && !session.glOk.value
            ? t('layerEditor.webglUnavailable')
            : t('layerEditor.exportPsdFailed')
      })
    } finally {
      session?.dispose()
      exporting.value = false
    }
  }

  return { exporting, downloadPsd }
}
