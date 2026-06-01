import { describe, expect, it } from 'vitest'

import type { PanelResizeChange } from '@/composables/useStablePrimeVueSplitterSizer'

import {
  LINEAR_VIEW_PANEL_STORAGE_KEY,
  buildInputPanelResizeMetadata
} from './linearViewPanelTelemetry'

function change(
  storageKey: string,
  oldWidth: number | null,
  newWidth: number
): PanelResizeChange {
  return { storageKey, oldWidth, newWidth }
}

describe('buildInputPanelResizeMetadata', () => {
  it('reads the right panel when the sidebar is on the left', () => {
    const changes = [
      change(LINEAR_VIEW_PANEL_STORAGE_KEY.left, 200, 260),
      change(LINEAR_VIEW_PANEL_STORAGE_KEY.right, 320, 480)
    ]

    expect(buildInputPanelResizeMetadata(changes, true)).toEqual({
      panel: 'input',
      direction: 'wider',
      previous_width_px: 320,
      new_width_px: 480,
      sidebar_location: 'left'
    })
  })

  it('reads the left panel when the sidebar is on the right', () => {
    const changes = [
      change(LINEAR_VIEW_PANEL_STORAGE_KEY.left, 480, 320),
      change(LINEAR_VIEW_PANEL_STORAGE_KEY.right, 200, 260)
    ]

    expect(buildInputPanelResizeMetadata(changes, false)).toEqual({
      panel: 'input',
      direction: 'narrower',
      previous_width_px: 480,
      new_width_px: 320,
      sidebar_location: 'right'
    })
  })

  it('returns null when only the sidebar panel changed', () => {
    const changes = [change(LINEAR_VIEW_PANEL_STORAGE_KEY.left, 200, 260)]

    expect(buildInputPanelResizeMetadata(changes, true)).toBeNull()
  })

  it('returns null when the input panel width did not change', () => {
    const changes = [change(LINEAR_VIEW_PANEL_STORAGE_KEY.right, 400, 400)]

    expect(buildInputPanelResizeMetadata(changes, true)).toBeNull()
  })

  it('returns null on the first measurement with no stored width', () => {
    const changes = [change(LINEAR_VIEW_PANEL_STORAGE_KEY.right, null, 400)]

    expect(buildInputPanelResizeMetadata(changes, true)).toBeNull()
  })
})
