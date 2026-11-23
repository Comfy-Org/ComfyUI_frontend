import type { Positionable } from '@comfyorg/graph-model/interfaces'
import { zClipboardItems } from '@comfyorg/graph-model/workflowSchema'
import { reportError } from '@comfyorg/telemetry/reportError'

import type { LGraphCanvas } from '@comfyorg/graph-model/entityRegistry'

import { createUuidv4 } from '@/utils/uuid'

import {
  discardClipboardStorage,
  readClipboardStorage,
  writeClipboardStorage
} from './clipboardStorage'
import { insertItems, serializeItems } from './graphTransfer'
import type { InsertOptions, InsertResult } from './graphTransfer'

let currentCopy:
  | {
      serialized: string
      stored: boolean
    }
  | undefined

export function forgetCanvasCopy(): void {
  currentCopy = undefined
}

export function isCurrentCanvasCopy(serialized: string): boolean {
  const cached = readClipboardStorage()
  if (cached !== undefined && cached !== null) {
    if (cached !== currentCopy?.serialized) forgetCanvasCopy()
    return serialized === cached
  }
  if (cached === undefined || !currentCopy?.stored)
    return serialized === currentCopy?.serialized
  return false
}

export function copyToCanvasClipboard(
  canvas: LGraphCanvas,
  items?: Iterable<Positionable>
):
  | { serialized: string; stored: boolean }
  | { serialized: undefined; stored: false } {
  let serialized: string
  try {
    serialized = JSON.stringify({
      ...serializeItems(canvas, items),
      clipboardId: createUuidv4()
    })
  } catch (error) {
    reportError(error, {
      errorType: 'error_serializing_clipboard_items',
      surface: 'graph'
    })
    return { serialized: undefined, stored: false }
  }
  const copy = { serialized, stored: writeClipboardStorage(serialized) }
  currentCopy = copy
  return copy
}

export function discardCanvasCopy(
  copy: ReturnType<typeof copyToCanvasClipboard> | undefined
): void {
  if (copy?.serialized !== undefined && copy.stored)
    discardClipboardStorage(copy.serialized)
}

export function pasteFromCanvasClipboard(
  canvas: LGraphCanvas,
  options: InsertOptions = {}
): InsertResult | undefined {
  const serialized = readClipboardStorage()
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
