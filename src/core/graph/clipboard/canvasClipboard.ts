import type { Positionable } from '@comfyorg/graph-model/interfaces'
import { zClipboardItems } from '@comfyorg/graph-model/workflowSchema'
import { reportError } from '@comfyorg/telemetry/reportError'

import type { LGraphCanvas } from '@comfyorg/graph-model/entityRegistry'

import {
  CANVAS_CLIPBOARD_KEY,
  discardClipboardStorage,
  readClipboardId,
  writeClipboardStorage
} from './clipboardStorage'
import { insertItems, serializeItems } from './graphTransfer'
import type { InsertOptions, InsertResult } from './graphTransfer'

let currentCopy:
  | {
      serialized: string
      stored: boolean
      id: string | null
      cachedSerialized: string | null
    }
  | undefined

export function forgetCanvasCopy(): void {
  currentCopy = undefined
}

function readCachedSerialized(): string | null | undefined {
  try {
    return localStorage.getItem(CANVAS_CLIPBOARD_KEY)
  } catch {
    return undefined
  }
}

export function isCurrentCanvasCopy(serialized: string): boolean {
  if (currentCopy && !currentCopy.stored) {
    const cached = readCachedSerialized()
    if (cached !== undefined && cached !== currentCopy.cachedSerialized) {
      forgetCanvasCopy()
      return serialized === cached
    }
    return serialized === currentCopy.serialized
  }
  try {
    return serialized === localStorage.getItem(CANVAS_CLIPBOARD_KEY)
  } catch {
    return serialized === currentCopy?.serialized
  }
}

export function copyToCanvasClipboard(
  canvas: LGraphCanvas,
  items?: Iterable<Positionable>
): { serialized: string; stored: boolean } {
  const serialized = JSON.stringify(serializeItems(canvas, items))
  const stored = writeClipboardStorage(serialized)
  currentCopy = {
    serialized,
    stored,
    id: stored ? readClipboardId() : null,
    cachedSerialized: stored ? serialized : (readCachedSerialized() ?? null)
  }
  return currentCopy
}

export function discardCanvasCopy(
  copy: ReturnType<typeof copyToCanvasClipboard> | undefined
): void {
  if (
    currentCopy &&
    currentCopy === copy &&
    currentCopy.stored &&
    readClipboardId() === currentCopy.id
  ) {
    discardClipboardStorage()
  }
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
