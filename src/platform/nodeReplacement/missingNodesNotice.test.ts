import { describe, expect, it, vi } from 'vitest'

import {
  setMissingNodesNotice,
  showMissingNodesNotice
} from '@/platform/nodeReplacement/missingNodesNotice'
import type { MissingNodeType } from '@/platform/nodeReplacement/types'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

const NODES: MissingNodeType[] = [{ type: 'BiRefNet', isReplaceable: false }]

describe(showMissingNodesNotice, () => {
  it('shows the error overlay, or the notice a surface set in its place', () => {
    showMissingNodesNotice(NODES)
    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)

    useExecutionErrorStore().dismissErrorOverlay()
    const notice = vi.fn()
    setMissingNodesNotice(notice)
    showMissingNodesNotice(NODES)

    expect(notice).toHaveBeenCalledWith(NODES)
    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)
  })
})
