import { describe, expect, it, vi } from 'vitest'

import {
  setMissingNodesNotice,
  showMissingNodesNotice
} from '@/platform/workflowErrors/nodeReplacement/missingNodesNotice'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

const NODES: MissingNodeType[] = [{ type: 'BiRefNet', isReplaceable: false }]

describe(showMissingNodesNotice, () => {
  it('shows the notice a surface set in place of the error overlay, until the surface takes it back', () => {
    const notice = vi.fn()
    const restore = setMissingNodesNotice(notice)
    showMissingNodesNotice(NODES)

    expect(notice).toHaveBeenCalledWith(NODES, 'brought_in')
    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(false)

    restore()
    showMissingNodesNotice(NODES)

    expect(notice).toHaveBeenCalledOnce()
    expect(useExecutionErrorStore().isErrorOverlayOpen).toBe(true)
  })

  it('tells the notice a workflow was reopened', () => {
    const notice = vi.fn()
    const restore = setMissingNodesNotice(notice)
    showMissingNodesNotice(NODES, 'reopened')
    restore()

    expect(notice).toHaveBeenCalledWith(NODES, 'reopened')
  })
})
