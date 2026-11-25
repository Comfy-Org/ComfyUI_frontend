import { useEventListener } from '@vueuse/core'

import { useToast } from '@/components/ui/toast/toastStore'
import { useErrorHandling } from '@/composables/useErrorHandling'
import {
  isCurrentCanvasCopy,
  pasteFromCanvasClipboard
} from '@/core/graph/clipboard/canvasClipboard'
import { insertItems } from '@/core/graph/clipboard/graphTransfer'
import { t } from '@/i18n'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
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
  return parsed.status === 'read' && isCurrentCanvasCopy(parsed.text)
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

function pasteMediaFile(
  canvas: LGraphCanvas,
  items: DataTransferItemList,
  selectedNode: LGraphNode | undefined
): Promise<LGraphNode | null> | undefined {
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      return pasteImageNode(
        canvas,
        items,
        isImageNode(selectedNode) ? selectedNode : null
      )
    } else if (item.type.startsWith('video/')) {
      return pasteVideoNode(
        canvas,
        items,
        isVideoNode(selectedNode) ? selectedNode : null
      )
    } else if (item.type.startsWith('audio/')) {
      return pasteAudioNode(
        canvas,
        items,
        isAudioNode(selectedNode) ? selectedNode : null
      )
    }
  }
}

async function pasteText(
  canvas: LGraphCanvas,
  data: string,
  isMediaNodeSelected: boolean,
  target: EventTarget | null
): Promise<void> {
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
    await useApp().loadGraphData(workflow, true, true, null, {
      initiator: 'user'
    })
  } else {
    if (
      (target instanceof HTMLTextAreaElement && target.type === 'textarea') ||
      (target instanceof HTMLInputElement && target.type === 'text')
    ) {
      return
    }

    if (!isMediaNodeSelected) {
      pasteFromCanvasClipboard(canvas)
    } else {
      useToast().info(t('toastMessages.nothingToPasteIntoNode'), {
        duration: 3000
      })
    }
  }
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

    if (!e.clipboardData) {
      console.error('No clipboard data on clipboard event')
      return
    }
    const data = cloneDataTransfer(e.clipboardData)
    const selectedNode = canvas.current_node?.is_selected
      ? canvas.current_node
      : undefined
    const mediaPaste = pasteMediaFile(canvas, data.items, selectedNode)
    if (mediaPaste) {
      await mediaPaste
      return
    }

    const isMediaNodeSelected =
      isImageNode(selectedNode) ||
      isVideoNode(selectedNode) ||
      isAudioNode(selectedNode)
    const html = data.getData('text/html')
    if (
      (!isMediaNodeSelected || holdsLatestCanvasCopy(html)) &&
      pasteClipboardItems(data)
    )
      return

    await pasteText(
      canvas,
      data.getData('text/plain'),
      isMediaNodeSelected,
      e.target
    )
  })
}
