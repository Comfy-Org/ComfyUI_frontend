import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, watch } from 'vue'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import { setRootGraph } from '@/scripts/__tests__/appTestUtils'
import { app } from '@/scripts/app'

const setGraph = (graph: LGraph | undefined) => setRootGraph(app, graph)

describe('ComfyApp graph-readiness reactivity', () => {
  beforeEach(() => setGraph(undefined))

  // Every other test mocks `@/scripts/app`, so this is the only place the real
  // `shallowRef` seam is asserted.
  it('a watcher over app.isGraphReady sees the setup() transition', async () => {
    const scope = effectScope()
    const seen: boolean[] = []
    scope.run(() => {
      watch(
        () => app.isGraphReady,
        (value) => seen.push(value)
      )
    })

    expect(app.isGraphReady).toBe(false)
    setGraph(new LGraph())
    await nextTick()
    scope.stop()

    expect(seen).toEqual([true])
  })

  it('a reactive watch target resolves late once the graph arrives', async () => {
    const scope = effectScope()
    const resolved: unknown[] = []
    scope.run(() => {
      watch(
        () => (app.isGraphReady ? app.rootGraph.events : undefined),
        (target) => resolved.push(target),
        { immediate: true }
      )
    })

    expect(resolved).toEqual([undefined])
    setGraph(new LGraph())
    await nextTick()
    scope.stop()

    expect(resolved).toHaveLength(2)
    expect(resolved[1]).toBeDefined()
  })
})
