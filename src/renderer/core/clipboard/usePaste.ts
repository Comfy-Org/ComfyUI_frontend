import { useEventListener } from '@vueuse/core'

import { useToast } from '@/components/ui/toast/toastStore'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { pasteFromCanvasClipboard } from '@/core/graph/clipboard/canvasClipboard'
import { CANVAS_CLIPBOARD_KEY } from '@/core/graph/clipboard/clipboardStorage'
import { insertItems } from '@/core/graph/clipboard/graphTransfer'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { zClipboardItems } from '@comfyorg/graph-model/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useApp } from '@/scripts/appInstance'
import type { ComfyApp } from '@/types/comfy'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  isAudioNode,
  isImageNode,
  isSelectOnly,
  isVideoNode
} from '@/utils/litegraphUtil'

import { parseClipboardHtml } from './clipboardHtml'
import { shouldIgnoreCopyPaste } from './clipboardTarget'
import {
  pasteAudioNode,
  pasteImageNode,
  pasteVideoNode
} from './mediaClipboard'

export function cloneDataTransfer(original: DataTransfer): DataTransfer {
  const persistent = new DataTransfer()

  for (const type of original.types) {
    const data = original.getData(type)
    if (data) {
      persistent.setData(type, data)
    }
  }

  for (const item of original.items) {
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) {
        persistent.items.add(file)
      }
    }
  }

  persistent.dropEffect = original.dropEffect
  persistent.effectAllowed = original.effectAllowed

  return persistent
}

function pasteClipboardItems(data: DataTransfer): boolean {
  const parsed = parseClipboardHtml(data.getData('text/html'))
  if (parsed.status === 'absent') return false
  if (parsed.status === 'unreadable') {
    useErrorHandling().toastErrorHandler(parsed.cause)
    return true
  }

  const clipboardItems = zClipboardItems.safeParse(parsed.payload)
  if (!clipboardItems.success) {
    useErrorHandling().toastErrorHandler(clipboardItems.error)
    return true
  }

  try {
    insertItems(useCanvasStore().getCanvas(), clipboardItems.data, {})
  } catch (err) {
    useErrorHandling().toastErrorHandler(err)
  }
  return true
}

function holdsLatestCanvasCopy(html: string): boolean {
  const parsed = parseClipboardHtml(html)
  if (parsed.status !== 'read') return false
  try {
    return parsed.text === localStorage.getItem(CANVAS_CLIPBOARD_KEY)
  } catch {
    return false
  }
}

function isWorkflow(
  value: unknown
): value is Parameters<ComfyApp['loadGraphData']>[0] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    (typeof value.version === 'number' || typeof value.version === 'string') &&
    'nodes' in value &&
    Array.isArray(value.nodes) &&
    'extra' in value &&
    typeof value.extra === 'object' &&
    value.extra !== null &&
    !Array.isArray(value.extra)
  )
}

export const usePaste = () => {
  const workspaceStore = useWorkspaceStore()
  const canvasStore = useCanvasStore()

  useEventListener(document, 'paste', async (e) => {
    if (e.defaultPrevented) return
    if (shouldIgnoreCopyPaste(e.target)) {
      return
    }
    if (workspaceStore.shiftDown) return

    const { canvas } = canvasStore
    if (!canvas || isSelectOnly(canvas)) return

    let data: DataTransfer | string | null = e.clipboardData
    if (!data) {
      console.error('No clipboard data on clipboard event')
      return
    }
    data = cloneDataTransfer(data)

    const { items } = data

    const currentNode = canvas.current_node
    const isNodeSelected = currentNode?.is_selected

    const isImageNodeSelected = isNodeSelected && isImageNode(currentNode)
    const isVideoNodeSelected = isNodeSelected && isVideoNode(currentNode)
    const isAudioNodeSelected = isNodeSelected && isAudioNode(currentNode)

    const audioNode: LGraphNode | null = isAudioNodeSelected
      ? currentNode
      : null
    const imageNode: LGraphNode | null = isImageNodeSelected
      ? currentNode
      : null
    const videoNode: LGraphNode | null = isVideoNodeSelected
      ? currentNode
      : null

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        await pasteImageNode(canvas, items, imageNode)
        return
      } else if (item.type.startsWith('video/')) {
        await pasteVideoNode(canvas, items, videoNode)
        return
      } else if (item.type.startsWith('audio/')) {
        await pasteAudioNode(canvas, items, audioNode)
        return
      }
    }

    const isMediaNodeSelected =
      isImageNodeSelected || isVideoNodeSelected || isAudioNodeSelected
    if (!isMediaNodeSelected && pasteClipboardItems(data)) return
    const html = data.getData('text/html')

    data = data.getData('text/plain')
    let workflow: unknown
    try {
      data = data.slice(data.indexOf('{'))
      workflow = JSON.parse(data)
    } catch {
      try {
        data = data.slice(data.indexOf('workflow\n'))
        data = data.slice(data.indexOf('{'))
        workflow = JSON.parse(data)
      } catch {
        workflow = null
      }
    }

    if (isWorkflow(workflow)) {
      await useApp().loadGraphData(workflow)
    } else {
      if (
        (e.target instanceof HTMLTextAreaElement &&
          e.target.type === 'textarea') ||
        (e.target instanceof HTMLInputElement && e.target.type === 'text')
      ) {
        return
      }

      if (!isMediaNodeSelected || holdsLatestCanvasCopy(html)) {
        pasteFromCanvasClipboard(canvas)
      } else {
        useToast().info(t('toastMessages.nothingToPasteIntoNode'), {
          duration: 3000
        })
      }
    }
  })
}
