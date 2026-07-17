import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { toNodeId } from '@/types/nodeId'

const restoreView = vi.hoisted(() => vi.fn())
vi.mock('./subgraphNavigation', () => ({ restoreView }))

const resolveTourRoles = vi.hoisted(() => vi.fn())
vi.mock('./roleResolution', () => ({ resolveTourRoles }))

const sinkNode = vi.hoisted(() => ({}) as object)
const resolveNode = vi.hoisted(() => vi.fn())
vi.mock('@/utils/litegraphUtil', () => ({ resolveNode }))

const getNodeImageUrls = vi.hoisted(() => vi.fn())
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({ getNodeImageUrls })
}))

// Reactive so `until(sinkUrl)` wakes on a real dependency change rather than
// relying on incidental re-polling of a plain mock.
const sinkOutput = ref<string[] | undefined>(['blob:sink-output'])

const isDialogOpen = vi.hoisted(() => vi.fn(() => false))
vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ isDialogOpen })
}))

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { useFirstRunTourStore } from './firstRunTourStore'
import type { ResolvedRoles } from './tourSequence'

const workflow = {} as ComfyWorkflowJSON

const i2vRoles: ResolvedRoles = {
  source: { nodeId: toNodeId(97) },
  prompt: {
    subgraphNodeId: toNodeId(10),
    innerNodeId: toNodeId(93),
    widgetName: 'text',
    portFallback: 'prompt'
  },
  engine: { nodeId: toNodeId(86) },
  sink: { nodeId: toNodeId(108) },
  mediaKind: 'video'
}

const t2iRoles: ResolvedRoles = {
  source: null,
  prompt: {
    subgraphNodeId: toNodeId(10),
    innerNodeId: toNodeId(27),
    widgetName: 'text',
    portFallback: 'prompt'
  },
  engine: { nodeId: toNodeId(3) },
  sink: { nodeId: toNodeId(9) },
  mediaKind: 'image'
}

describe('firstRunTourStore', () => {
  let store: ReturnType<typeof useFirstRunTourStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useFirstRunTourStore()
    resolveTourRoles.mockReset()
    restoreView.mockReset()
    resolveNode.mockReset()
    getNodeImageUrls.mockReset()
    resolveNode.mockReturnValue(sinkNode)
    sinkOutput.value = ['blob:sink-output']
    getNodeImageUrls.mockImplementation(() => sinkOutput.value)
    isDialogOpen.mockReset()
    isDialogOpen.mockReturnValue(false)
  })

  it('prepare() on I2V roles builds [Upload, Prompt, Run, Result] and reveals the source', () => {
    resolveTourRoles.mockReturnValue(i2vRoles)

    store.prepare(workflow)

    expect(resolveTourRoles).toHaveBeenCalledWith(workflow, undefined)
    expect(store.stepIndex).toBe(0)
    expect(store.steps.map((s) => s.kind)).toEqual([
      'upload',
      'prompt',
      'run',
      'result'
    ])
    expect([...store.revealedNodeIds]).toEqual([toNodeId(97)])
  })

  it('prepare() passes the templateId through to the resolver', () => {
    resolveTourRoles.mockReturnValue(t2iRoles)

    store.prepare(workflow, 'image_z_image_turbo')

    expect(resolveTourRoles).toHaveBeenCalledWith(
      workflow,
      'image_z_image_turbo'
    )
  })

  it('prepare() on T2I roles omits the Upload step', () => {
    resolveTourRoles.mockReturnValue(t2iRoles)

    store.prepare(workflow)

    expect(store.steps.map((s) => s.kind)).toEqual(['prompt', 'run', 'result'])
    // T2I opens on the prompt step, revealing its collapsed subgraph host.
    expect([...store.revealedNodeIds]).toEqual([toNodeId(10)])
  })

  it('reveals accumulate as the step index advances so the graph builds up', () => {
    resolveTourRoles.mockReturnValue(i2vRoles)
    store.prepare(workflow)

    store.stepIndex = 1 // prompt (nodeId null, reveals the subgraph host)
    expect([...store.revealedNodeIds]).toEqual([toNodeId(97), toNodeId(10)])

    store.stepIndex = 2 // run (no node)
    expect([...store.revealedNodeIds]).toEqual([toNodeId(97), toNodeId(10)])
  })

  it('collapses to only the sink on the Result step', () => {
    resolveTourRoles.mockReturnValue(i2vRoles)
    store.prepare(workflow)
    store.stepIndex = 3 // result

    // The final step focuses solely on the generated output, hiding the rest.
    expect([...store.revealedNodeIds]).toEqual([toNodeId(108)])
  })

  it('spotlitNodeIds tracks only the current step while reveals accumulate', () => {
    resolveTourRoles.mockReturnValue(i2vRoles)
    store.prepare(workflow)

    // Upload step: source revealed and spotlit.
    expect([...store.revealedNodeIds]).toEqual([toNodeId(97)])
    expect([...store.spotlitNodeIds]).toEqual([toNodeId(97)])

    store.stepIndex = 1 // prompt (reveals the subgraph host)
    // Reveals accumulate; the spotlight narrows to just the prompt host.
    expect([...store.revealedNodeIds]).toEqual([toNodeId(97), toNodeId(10)])
    expect([...store.spotlitNodeIds]).toEqual([toNodeId(10)])

    store.stepIndex = 2 // run (no node)
    expect([...store.spotlitNodeIds]).toEqual([])

    store.stepIndex = 3 // result (sink)
    // Result collapses to only the sink for both spotlight and reveal.
    expect([...store.spotlitNodeIds]).toEqual([toNodeId(108)])
    expect([...store.revealedNodeIds]).toEqual([toNodeId(108)])
  })

  it('recomputes the prior reveal set when the step index steps back', () => {
    resolveTourRoles.mockReturnValue(i2vRoles)
    store.prepare(workflow)
    store.stepIndex = 1

    store.stepIndex = 0

    expect([...store.revealedNodeIds]).toEqual([toNodeId(97)])
  })

  it('end() restores the view and resets to idle', () => {
    resolveTourRoles.mockReturnValue(i2vRoles)
    store.prepare(workflow)
    store.stepIndex = 1

    store.end()

    expect(restoreView).toHaveBeenCalledOnce()
    expect(store.isActive).toBe(false)
    expect(store.stepIndex).toBe(0)
    expect(store.resolvedRoles).toBeNull()
    expect(store.steps).toEqual([])
    expect(store.revealedNodeIds.size).toBe(0)
  })

  it('degrades to a lone Run step when prompt and sink are unresolved', () => {
    resolveTourRoles.mockReturnValue({ ...t2iRoles, prompt: null, sink: null })

    store.prepare(workflow)

    // No prompt AND no sink → still builds the always-present Run step rather than crashing.
    expect(store.steps.map((s) => s.kind)).toEqual(['run'])
  })

  it('captureResultMedia() records the sink output URL with the resolved media kind', async () => {
    resolveTourRoles.mockReturnValue(i2vRoles)
    store.prepare(workflow)
    store.isActive = true

    await store.captureResultMedia()

    expect(resolveNode).toHaveBeenCalledWith(toNodeId(108))
    expect(getNodeImageUrls).toHaveBeenCalledWith(sinkNode)
    expect(store.resultMedia).toEqual({
      url: 'blob:sink-output',
      kind: 'video'
    })
  })

  it('captureResultMedia() waits for the URL to appear before recording it', async () => {
    resolveTourRoles.mockReturnValue(t2iRoles)
    store.prepare(workflow)
    store.isActive = true
    sinkOutput.value = undefined

    const pending = store.captureResultMedia()
    // The cloud queue refresh fills the output just after execution_success.
    sinkOutput.value = ['blob:late-output']
    await pending

    expect(store.resultMedia).toEqual({
      url: 'blob:late-output',
      kind: 'image'
    })
  })

  it('captureResultMedia() is a no-op while the tour is idle', async () => {
    await store.captureResultMedia()

    expect(resolveNode).not.toHaveBeenCalled()
    expect(store.resultMedia).toBeNull()
  })

  it('captureResultMedia() discards the URL if the tour ends mid-wait', async () => {
    resolveTourRoles.mockReturnValue(t2iRoles)
    store.prepare(workflow)
    store.isActive = true
    sinkOutput.value = undefined

    // The tour ends (user skips) during the wait; the URL then resolves, but the
    // post-await guard must drop it rather than record into a dead tour.
    const pending = store.captureResultMedia()
    store.end()
    sinkOutput.value = ['blob:late-output']
    await pending

    expect(store.resultMedia).toBeNull()
  })

  it('captureResultMedia() discards the URL if a newer tour started mid-wait', async () => {
    resolveTourRoles.mockReturnValue(t2iRoles)
    store.prepare(workflow)
    store.isActive = true
    sinkOutput.value = undefined

    // The original tour's capture is still waiting when a fresh tour starts
    // (prepare bumps tourRunId). The late URL must not write into the new run.
    const pending = store.captureResultMedia()
    store.prepare(workflow)
    store.isActive = true
    sinkOutput.value = ['blob:late-output']
    await pending

    expect(store.resultMedia).toBeNull()
  })

  it('captureResultMedia() is idempotent once the media is set', async () => {
    resolveTourRoles.mockReturnValue(t2iRoles)
    store.prepare(workflow)
    store.isActive = true
    await store.captureResultMedia()
    sinkOutput.value = ['blob:second-run']

    await store.captureResultMedia()

    // A second success must not overwrite the first captured result.
    expect(store.resultMedia).toEqual({
      url: 'blob:sink-output',
      kind: 'image'
    })
  })

  it('captureResultMedia() gives up after the timeout without recording', async () => {
    vi.useFakeTimers()
    resolveTourRoles.mockReturnValue(t2iRoles)
    store.prepare(workflow)
    store.isActive = true
    sinkOutput.value = undefined

    const pending = store.captureResultMedia()
    await vi.runAllTimersAsync()
    await pending

    expect(store.resultMedia).toBeNull()
    vi.useRealTimers()
  })

  it('prepare() clears a previous tour’s finished run so the next one can generate', () => {
    // The flag drives the Result step's "Generating…"; carried over, a second tour
    // would show its result as already done.
    resolveTourRoles.mockReturnValue(t2iRoles)
    store.prepare(workflow)
    store.runFinished = true

    store.prepare(workflow)

    expect(store.runFinished).toBe(false)
  })

  it('showNudge() surfaces the post-run nudge', () => {
    expect(store.shouldShowNudge).toBe(false)

    store.showNudge()

    expect(store.shouldShowNudge).toBe(true)
  })

  it('keeps the nudge visible after the tour ends so it outlives the run', () => {
    resolveTourRoles.mockReturnValue(t2iRoles)
    store.prepare(workflow)
    store.showNudge()

    store.end()

    expect(store.shouldShowNudge).toBe(true)
  })

  it('keeps the captured media after the tour ends so the nudge still shows it', () => {
    resolveTourRoles.mockReturnValue(t2iRoles)
    store.prepare(workflow)
    store.resultMedia = { url: 'blob:first-run', kind: 'image' }
    store.showNudge()

    store.end()

    expect(store.resultMedia).toEqual({ url: 'blob:first-run', kind: 'image' })
  })

  it('defers the nudge while the upgrade modal is open, then surfaces it on close', () => {
    isDialogOpen.mockReturnValue(true)

    store.showNudge()

    // Held back so it never overlaps the paywall; the arm flag drives the retry.
    expect(store.shouldShowNudge).toBe(false)
    expect(store.nudgeArmed).toBe(true)

    // The end of the tour must not lose the deferred nudge.
    store.end()
    expect(store.nudgeArmed).toBe(true)

    isDialogOpen.mockReturnValue(false)
    store.showNudge()

    expect(store.shouldShowNudge).toBe(true)
    expect(store.nudgeArmed).toBe(false)
  })

  it('dismissNudge() hides it and blocks any later re-trigger this session', () => {
    store.showNudge()
    expect(store.shouldShowNudge).toBe(true)

    store.dismissNudge()
    expect(store.shouldShowNudge).toBe(false)

    store.showNudge()
    expect(store.shouldShowNudge).toBe(false)
  })

  it('prepare() resets the nudge lifecycle for a fresh tour', () => {
    resolveTourRoles.mockReturnValue(t2iRoles)
    store.showNudge()
    store.dismissNudge()
    store.resultMedia = { url: 'blob:prior-run', kind: 'image' }

    store.prepare(workflow)

    expect(store.shouldShowNudge).toBe(false)
    expect(store.nudgeArmed).toBe(false)
    // The prior run's media is cleared with the rest of the nudge lifecycle.
    expect(store.resultMedia).toBeNull()

    // Dismissal from the prior tour no longer blocks the new one.
    store.showNudge()
    expect(store.shouldShowNudge).toBe(true)
  })
})
