import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toNodeId } from '@/types/nodeId'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

async function loadReporter() {
  vi.resetModules()
  return (await import('./domWidgetMountReporting')).reportDomWidgetMountFailure
}

const context = {
  nodeId: toNodeId(7),
  nodeType: 'PreviewImage',
  widgetName: 'preview'
}

describe('reportDomWidgetMountFailure', () => {
  beforeEach(() => {
    mockReportError.mockClear()
  })

  it('reports the failure with the node and widget that could not mount', async () => {
    const report = await loadReporter()

    report(new Error('appendChild failed'), context)

    expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ message: 'appendChild failed' }),
      expect.objectContaining({
        errorType: 'canvas_dom_widget_mount_failed',
        context
      })
    )
  })

  it('deduplicates a systemic cause so every widget in a graph reports once', async () => {
    const report = await loadReporter()

    for (let nodeId = 0; nodeId < 50; nodeId++) {
      report(new Error('appendChild failed'), {
        ...context,
        nodeId: toNodeId(nodeId)
      })
    }

    expect(mockReportError).toHaveBeenCalledOnce()
  })

  it('caps distinct failures per session', async () => {
    const report = await loadReporter()

    for (let i = 0; i < 25; i++) report(new Error(`failure ${i}`), context)

    expect(mockReportError).toHaveBeenCalledTimes(20)
  })
})
