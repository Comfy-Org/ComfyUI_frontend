import type { Positionable } from '@comfyorg/graph-model/interfaces'
import { zClipboardItems } from '@comfyorg/graph-model/workflowSchema'
import { reportError } from '@comfyorg/telemetry/reportError'

import type { LGraphCanvas } from '@comfyorg/graph-model/entityRegistry'

import { CANVAS_CLIPBOARD_KEY, writeClipboardStorage } from './clipboardStorage'
import { insertItems, serializeItems } from './graphTransfer'
import type { InsertOptions, InsertResult } from './graphTransfer'

export function copyToCanvasClipboard(
  canvas: LGraphCanvas,
  items?: Iterable<Positionable>
): { serialized: string; stored: boolean } {
  const serialized = JSON.stringify(serializeItems(canvas, items))
  const stored = writeClipboardStorage(serialized)
  return { serialized, stored }
}

export function pasteFromCanvasClipboard(
  canvas: LGraphCanvas,
  options: InsertOptions = {}
): InsertResult | undefined {
  let serialized: string | null
  try {
    serialized = localStorage.getItem(CANVAS_CLIPBOARD_KEY)
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'SecurityError')) {
      reportError(error, {
        errorType: 'error_reading_clipboard_storage',
        surface: 'graph'
      })
    }
    return
  }
  if (!serialized) return

  let payload: unknown
  try {
    payload = JSON.parse(serialized)
  } catch (error) {
    reportError(error, {
      errorType: 'error_reading_clipboard_storage',
      surface: 'graph'
    })
    return
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'links' in payload &&
    Array.isArray(payload.links)
  ) {
    payload = {
      ...payload,
      links: payload.links.map((link: unknown) => {
        if (typeof link !== 'object' || link === null) return link
        return {
          ...link,
          hidden: 'hidden' in link && link.hidden === true,
          label:
            'label' in link && typeof link.label === 'string'
              ? link.label
              : undefined
        }
      })
    }
  }

  const items = zClipboardItems.safeParse(payload)
  if (!items.success) {
    reportError(items.error, {
      errorType: 'error_reading_clipboard_storage',
      surface: 'graph'
    })
    return
  }
  return insertItems(canvas, items.data, options)
}
