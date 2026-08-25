import { useEventListener } from '@vueuse/core'
import { effectScope, nextTick, watchEffect } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import { getRootGraph, setRootGraph } from '@/scripts/__tests__/appTestUtils'
import { app } from '@/scripts/app'

describe('ComfyApp root graph readiness', () => {
  let scope: ReturnType<typeof effectScope>
  let previousRootGraph: LGraph | undefined

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    previousRootGraph = getRootGraph(app)
    setRootGraph(app, undefined)
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
    setRootGraph(app, previousRootGraph)
  })

  it('re-runs an effect reading isGraphReady when the graph is assigned', async () => {
    const readiness: boolean[] = []
    scope.run(() => {
      watchEffect(() => readiness.push(app.isGraphReady))
    })

    expect(readiness).toEqual([false])

    setRootGraph(app, new LGraph())
    await nextTick()

    expect(readiness).toEqual([false, true])
  })

  it('binds a rootGraph.events listener registered before the graph exists', async () => {
    const onConfigured = vi.fn()
    scope.run(() => {
      useEventListener(() => app.rootGraph?.events, 'configured', onConfigured)
    })

    const graph = new LGraph()
    setRootGraph(app, graph)
    await nextTick()
    graph.events.dispatch('configured')

    expect(onConfigured).toHaveBeenCalledOnce()
  })

  it('rebinds a rootGraph.events listener when the graph is replaced', async () => {
    const onConfigured = vi.fn()
    const firstGraph = new LGraph()
    setRootGraph(app, firstGraph)
    scope.run(() => {
      useEventListener(() => app.rootGraph?.events, 'configured', onConfigured)
    })

    const secondGraph = new LGraph()
    setRootGraph(app, secondGraph)
    await nextTick()

    firstGraph.events.dispatch('configured')
    expect(onConfigured).not.toHaveBeenCalled()

    secondGraph.events.dispatch('configured')
    expect(onConfigured).toHaveBeenCalledOnce()
  })
})
