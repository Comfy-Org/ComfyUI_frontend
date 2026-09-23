import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadBlob } from '@/base/common/downloadUtil'
import type { LayerEditorSession } from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import { buildPsdFromEditor } from '@/renderer/extensions/layerEditor/psdExport'
import { useToastStore } from '@/platform/updates/common/toastStore'

const PSD_MIME = 'image/vnd.adobe.photoshop'

function exportTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `${date}-${time}`
}

export function psdExportFilename(d: Date): string {
  return `comfyui-layers-${exportTimestamp(d)}.psd`
}

function readbackCanvas(session: LayerEditorSession): HTMLCanvasElement {
  const img = session.compositor.readback()
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.putImageData(img, 0, 0)
  return canvas
}

export async function buildSessionPsdBlob(
  session: LayerEditorSession
): Promise<Blob> {
  const { editor, content } = session
  if (editor.floating()) editor.anchorFloating()
  const guides = editor.guides()
  const psd = await buildPsdFromEditor(
    {
      document: () => editor.document(),
      render: () => editor.render(),
      readbackCanvas: () => readbackCanvas(session)
    },
    content,
    {
      guides: {
        horizontal: guides.filter((g) => g.axis === 'y').map((g) => g.pos),
        vertical: guides.filter((g) => g.axis === 'x').map((g) => g.pos)
      }
    }
  )
  const { writePsd } = await import('ag-psd')
  return new Blob([writePsd(psd)], { type: PSD_MIME })
}

export function useLayerEditorExport(session: LayerEditorSession) {
  const { t } = useI18n()
  const toastStore = useToastStore()
  const exporting = ref(false)

  async function exportPsd(): Promise<void> {
    if (!session.glOk.value || exporting.value) return
    exporting.value = true
    try {
      const blob = await buildSessionPsdBlob(session)
      downloadBlob(psdExportFilename(new Date()), blob)
    } catch (err) {
      console.warn('[LayerEditor] PSD export failed', err)
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('layerEditor.exportPsdFailed')
      })
    } finally {
      exporting.value = false
      session.requestRender()
    }
  }

  return { exporting, exportPsd }
}
