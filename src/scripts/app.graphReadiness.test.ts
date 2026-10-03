import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, watch } from 'vue'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

/** Stands in for the single assignment `ComfyApp.setup()` makes. */
const setGraph = (graph: LGraph | undefined) => {
  ;(
    app as unknown as {
      rootGraphInternal: LGraph | undefined
    }
  ).rootGraphInternal = graph
}

describe('ComfyApp graph-readiness reactivity', () => {
  beforeEach(() => setGraph(undefined))

  // Guards the `shallowRef` backing `rootGraphInternal`. As a plain field this
  // transition is invisible, and useWorkflowPacks' deferred fetch is never
  // served (CLOUD-FRONTEND-PROD-1YN / PR #19736). Every other test mocks
  // `@/scripts/app`, so this is the only place the real seam is asserted.
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
