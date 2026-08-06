import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadBlob } from '@/base/common/downloadUtil'
import { loadCompositorSession } from '@/composables/compositor/compositorSession'
import {
  buildSessionPsdBlob,
  psdExportFilename
} from '@/composables/layerEditor/useLayerEditorExport'
import type { LayerEditorSession } from '@/composables/layerEditor/useLayerEditorSession'
import { useLayerEditorSession } from '@/composables/layerEditor/useLayerEditorSession'
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
    const session = createSession()
    try {
      if (!session.glOk.value) throw new Error('WebGL compositor unavailable')
      await loadCompositorSession(session, node, (i) =>
        t('layerEditor.layerN', { n: i + 1 })
      )
      const blob = await buildSessionPsdBlob(session)
      downloadBlob(psdExportFilename(new Date()), blob)
    } catch (err) {
      console.warn('[Compositor] PSD export failed', err)
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('layerEditor.exportPsdFailed')
      })
    } finally {
      session.dispose()
      exporting.value = false
    }
  }

  return { exporting, downloadPsd }
}
