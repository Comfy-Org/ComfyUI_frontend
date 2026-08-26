import { describe, expect, it } from 'vitest'

import type { PerfIdentitySource } from '../browser_tests/fixtures/helpers/perfWorkloadIdentity'
import {
  buildPerfWorkloadIdentity,
  hashTopology,
  stableSerialize
} from '../browser_tests/fixtures/helpers/perfWorkloadIdentity'

const source: PerfIdentitySource = {
  nodes: [
    { id: '20', inputCount: 1, outputCount: 0, widgetCount: 2 },
    { id: '10', inputCount: 0, outputCount: 1, widgetCount: 1 }
  ],
  links: [{ originId: '10', originSlot: 0, targetId: '20', targetSlot: 0 }],
  visibleNodes: 2,
  renderer: 'legacy',
  canvasInfoEnabled: false,
  viewportWidth: 1280,
  viewportHeight: 720,
  devicePixelRatio: 1,
  frontendVersion: '1.2.3',
  frontendCommit: 'abc123',
  buildMode: 'test',
  browserVersion: 'Chromium 140',
  gpuClass: 'swiftshader'
}

describe('perf workload identity', () => {
  it('serializes objects deterministically', () => {
    expect(stableSerialize({ z: 1, a: { y: 2, x: 3 } })).toBe(
      stableSerialize({ a: { x: 3, y: 2 }, z: 1 })
    )
  })

  it('hashes topology independently of source ordering', () => {
    expect(hashTopology(source.nodes, source.links)).toBe(
      hashTopology([...source.nodes].reverse(), [...source.links].reverse())
    )
  })

  it('exports counts without workflow content or source node ids', () => {
    const identity = buildPerfWorkloadIdentity(source)
    const serialized = JSON.stringify(identity)

    expect(identity.topology).toMatchObject({
      nodes: 2,
      visibleNodes: 2,
      inputs: 1,
      outputs: 1,
      links: 1,
      maxFanOut: 1,
      widgets: 3
    })
    expect(serialized).not.toContain('"10"')
    expect(serialized).not.toContain('"20"')
  })

  it('marks unavailable activity instrumentation explicitly', () => {
    const identity = buildPerfWorkloadIdentity(source, {
      progressEventsReceived: 12,
      foregroundDraws: 4,
      dirtyReasons: { progress: 3, 'workflow secret': 99 }
    })

    expect(identity.activity.progressEventsReceived).toBe(12)
    expect(identity.missingOptionalFields).not.toContain(
      'activity.progressEventsReceived'
    )
    expect(identity.missingOptionalFields).toContain(
      'activity.progressEventsApplied'
    )
    expect(identity.activity.dirtyReasons).toEqual({ progress: 3 })
    expect(JSON.stringify(identity)).not.toContain('workflow secret')
  })
})
