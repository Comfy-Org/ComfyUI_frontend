import { reportError } from '@/platform/telemetry/reportError'
import { describe, expect, it, vi } from 'vitest'

import { serializeRootGraph } from '@/platform/openOnCloud/serializeRootGraph'
import { app } from '@/scripts/app'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/telemetry/reportError'))

describe(serializeRootGraph, () => {
  it('reports a graph that cannot be serialized and returns nothing', () => {
    vi.spyOn(app.rootGraph, 'serialize').mockImplementation(() => {
      throw new TypeError('cyclic link')
    })

    expect(serializeRootGraph()).toBeNull()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(TypeError),
      expect.objectContaining({
        errorType: 'failure_serializing_open_on_cloud_graph'
      })
    )
  })
})
