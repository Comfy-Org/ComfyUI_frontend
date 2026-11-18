import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadBlob } from '@/base/common/downloadUtil'
import type { LayerEditorSession } from '@comfyorg/layer-editor/vue'
import { buildSessionPsdBlob } from '@comfyorg/layer-editor/export/psdExport'
import { useToast } from '@/components/ui/toast/toastStore'

function exportTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `${date}-${time}`
}

export function psdExportFilename(d: Date): string {
  return `comfyui-layers-${exportTimestamp(d)}.psd`
}

export function useLayerEditorExport(session: LayerEditorSession) {
  const { t } = useI18n()
  const toast = useToast()
  const exporting = ref(false)

  async function exportPsd(): Promise<void> {
    if (!session.glOk.value || exporting.value) return
    exporting.value = true
    try {
      const blob = await buildSessionPsdBlob(session)
      downloadBlob(psdExportFilename(new Date()), blob)
    } catch (err) {
      console.warn('[LayerEditor] PSD export failed', err)
      toast.error(t('g.error'), {
        description: t('layerEditor.exportPsdFailed')
      })
    } finally {
      exporting.value = false
      session.requestRender()
    }
  }

  return { exporting, exportPsd }
}
