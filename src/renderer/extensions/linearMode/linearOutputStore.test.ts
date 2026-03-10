import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { ResultItemImpl } from '@/stores/queueStore'

const activeJobIdRef = ref<string | null>(null)
const previewsRef = ref<Record<string, { url: string; nodeId?: string }>>({})
const isAppModeRef = ref(true)
const activeWorkflowPathRef = ref<string>('workflows/test-workflow.json')
const jobIdToWorkflowPathRef = ref(new Map<string, string>())
const selectedOutputsRef = ref<string[]>([])

const { apiTarget } = vi.hoisted(() => ({
  apiTarget: new EventTarget()
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    isAppMode: isAppModeRef
  })
}))

vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => ({
    get selectedOutputs() {
      return selectedOutputsRef.value
    }
  })
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    get activeJobId() {
      return activeJobIdRef.value
    },
    get jobIdToSessionWorkflowPath() {
      return jobIdToWorkflowPathRef.value
    }
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return { path: activeWorkflowPathRef.value }
    }
  })
}))

vi.mock('@/stores/jobPreviewStore', () => ({
  useJobPreviewStore: () => ({
    get nodePreviewsByPromptId() {
      return previewsRef.value
    }
  })
}))

vi.mock('@/scripts/api', () => ({
  api: Object.assign(apiTarget, {
    apiURL: (path: string) => path
  })
}))

vi.mock('@/renderer/extensions/linearMode/flattenNodeOutput', () => ({
  flattenNodeOutput: ([nodeId, output]: [
    string | number,
    Record<string, unknown>
  ]) => {
    if (!output.images) return []
    return (output.images as Array<Record<string, string>>).map(
      (img) =>
        new ResultItemImpl({
          ...img,
          nodeId: String(nodeId),
          mediaType: 'images'
        })
    )
  }
}))

function setJobWorkflowPath(jobId: string, path: string) {
  const next = new Map(jobIdToWorkflowPathRef.value)
  next.set(jobId, path)
  jobIdToWorkflowPathRef.value = next
}

function makeExecutedDetail(
  promptId: string,
  images: Array<Record<string, string>> = [
    { filename: 'out.png', subfolder: '', type: 'output' }
  ],
  nodeId = '1'
): ExecutedWsMessage {
  return {
    prompt_id: promptId,
    node: nodeId,
    display_node: nodeId,
    output: { images }
  } as ExecutedWsMessage
}

describe('linearOutputStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    activeJobIdRef.value = null
    previewsRef.value = {}
    isAppModeRef.value = true
    activeWorkflowPathRef.value = 'workflows/test-workflow.json'
    jobIdToWorkflowPathRef.value = new Map()
    selectedOutputsRef.value = []
  })

  it('creates a skeleton item when a job starts', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    expect(store.inProgressItems).toHaveLength(1)
    expect(store.inProgressItems[0].state).toBe('skeleton')
    expect(store.inProgressItems[0].jobId).toBe('job-1')
  })

  it('auto-selects skeleton on first job start when no selection', () => {
    const store = useLinearOutputStore()
    setJobWorkflowPath('job-1', 'workflows/test-workflow.json')
    store.onJobStart('job-1')

    expect(store.selectedId).toBe(`slot:${store.inProgressItems[0].id}`)
  })

  it('transitions to latent on preview', () => {
    vi.useFakeTimers()
    const store = useLinearOutputStore()
    setJobWorkflowPath('job-1', 'workflows/test-workflow.json')
    store.onJobStart('job-1')

    const itemId = store.inProgressItems[0].id
    store.onLatentPreview('job-1', 'blob:preview')
    vi.advanceTimersByTime(16)

    expect(store.inProgressItems[0].state).toBe('latent')
    expect(store.inProgressItems[0].latentPreviewUrl).toBe('blob:preview')
    expect(store.selectedId).toBe(`slot:${itemId}`)
    vi.useRealTimers()
  })

  it('ignores latent preview for other jobs', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    store.onLatentPreview('job-other', 'blob:preview')

    expect(store.inProgressItems[0].state).toBe('skeleton')
  })

  it('transitions to image on executed event', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))

    const imageItems = store.inProgressItems.filter((i) => i.state === 'image')
    expect(imageItems).toHaveLength(1)
    expect(imageItems[0].output).toBeDefined()
  })

  it('does not create trailing skeleton after executed output', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))

    expect(store.inProgressItems).toHaveLength(1)
    expect(store.inProgressItems[0].state).toBe('image')
  })

  it('handles multi-output executed events', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    store.onNodeExecuted(
      'job-1',
      makeExecutedDetail('job-1', [
        { filename: 'a.png', subfolder: '', type: 'output' },
        { filename: 'b.png', subfolder: '', type: 'output' }
      ])
    )

    const imageItems = store.inProgressItems.filter((i) => i.state === 'image')
    expect(imageItems).toHaveLength(2)
  })

  it('removes slots when job ends without image outputs', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')
    expect(store.inProgressItems).toHaveLength(1)

    store.onJobComplete('job-1')

    expect(store.inProgressItems).toHaveLength(0)
    expect(store.pendingResolve.size).toBe(0)
  })

  it('adds to pendingResolve when job completes with images', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))

    store.onJobComplete('job-1')

    expect(store.inProgressItems.length).toBeGreaterThan(0)
    expect(store.pendingResolve.has('job-1')).toBe(true)
  })

  it('removes items when history resolves', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))

    store.onJobComplete('job-1')
    expect(store.inProgressItems.length).toBeGreaterThan(0)

    store.resolveIfReady('job-1', true)

    expect(store.inProgressItems).toHaveLength(0)
    expect(store.pendingResolve.has('job-1')).toBe(false)
  })

  it('does not resolve if history has not arrived', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))

    store.onJobComplete('job-1')

    store.resolveIfReady('job-1', false)

    expect(store.inProgressItems.length).toBeGreaterThan(0)
    expect(store.pendingResolve.has('job-1')).toBe(true)
  })

  it('does not auto-select when user is browsing history', () => {
    const store = useLinearOutputStore()

    // User manually selects a history item (browsing)
    store.select('history:asset-2:0')

    store.onJobStart('job-1')

    // Should NOT yank to in-progress — user is browsing
    expect(store.selectedId).toBe('history:asset-2:0')

    store.onLatentPreview('job-1', 'blob:preview')

    // Still should NOT yank
    expect(store.selectedId).toBe('history:asset-2:0')
  })

  it('auto-selects on new job when following latest', () => {
    const store = useLinearOutputStore()

    // selectAsLatest simulates "following the latest output"
    store.selectAsLatest('history:asset-1:0')

    setJobWorkflowPath('job-1', 'workflows/test-workflow.json')
    store.onJobStart('job-1')

    // Following latest → auto-select new skeleton
    expect(store.selectedId?.startsWith('slot:')).toBe(true)
  })

  it('does not auto-select on new job when browsing history', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    // User manually browses to an older output
    store.select('history:asset-1:0')

    store.onJobStart('job-2')

    // Should NOT auto-select — user is browsing
    expect(store.selectedId).toBe('history:asset-1:0')
  })

  it('falls back selection when selected item is removed', () => {
    const store = useLinearOutputStore()
    setJobWorkflowPath('job-1', 'workflows/test-workflow.json')
    store.onJobStart('job-1')
    const firstId = `slot:${store.inProgressItems[0].id}`
    expect(store.selectedId).toBe(firstId)

    store.onJobComplete('job-1')

    // Skeleton removed, no images, should clear selection
    expect(store.selectedId).toBeNull()
  })

  it('creates skeleton on-demand when latent arrives after execute', () => {
    vi.useFakeTimers()
    const store = useLinearOutputStore()
    store.onJobStart('job-1')
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))

    // No skeleton after execute
    expect(
      store.inProgressItems.filter((i) => i.state === 'skeleton')
    ).toHaveLength(0)

    // Next node sends latent preview — skeleton created on demand
    store.onLatentPreview('job-1', 'blob:next')
    vi.advanceTimersByTime(16)

    expect(store.inProgressItems[0].state).toBe('latent')
    expect(store.inProgressItems[0].latentPreviewUrl).toBe('blob:next')
    expect(store.inProgressItems).toHaveLength(2)
    vi.useRealTimers()
  })

  it('handles execute without prior skeleton (no latent preview)', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    // First node executes (consumes initial skeleton)
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))
    expect(store.inProgressItems).toHaveLength(1)

    // Second node executes directly (no latent, no skeleton)
    store.onNodeExecuted(
      'job-1',
      makeExecutedDetail('job-1', [
        { filename: 'b.png', subfolder: '', type: 'output' }
      ])
    )

    const images = store.inProgressItems.filter((i) => i.state === 'image')
    expect(images).toHaveLength(2)
  })

  it('does not fall back selection to stale items from other jobs', () => {
    const store = useLinearOutputStore()

    // Job 1 starts but is never completed (simulates watcher bug)
    store.onJobStart('job-1')
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))

    // Job 2 starts directly
    store.onJobStart('job-2')
    store.onNodeExecuted('job-2', makeExecutedDetail('job-2'))
    store.onJobComplete('job-2')

    // Resolve job-2
    store.resolveIfReady('job-2', true)

    // Should clear to null for history takeover, NOT fall back to job-1
    expect(store.selectedId).toBeNull()
  })

  it('transitions to latent via previews watcher', async () => {
    vi.useFakeTimers()
    const { nextTick } = await import('vue')
    const store = useLinearOutputStore()

    activeJobIdRef.value = 'job-1'
    await nextTick()

    expect(store.inProgressItems).toHaveLength(1)
    expect(store.inProgressItems[0].state).toBe('skeleton')

    // Simulate jobPreviewStore update
    previewsRef.value = {
      'job-1': { url: 'blob:preview-1', nodeId: 'node-1' }
    }
    await nextTick()
    vi.advanceTimersByTime(16)

    expect(store.inProgressItems[0].state).toBe('latent')
    expect(store.inProgressItems[0].latentPreviewUrl).toBe('blob:preview-1')
    vi.useRealTimers()
  })

  it('completes previous job on direct job transition', async () => {
    const { nextTick } = await import('vue')
    const store = useLinearOutputStore()

    activeJobIdRef.value = 'job-1'
    await nextTick()

    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))

    // Direct transition: job-1 → job-2 (no null in between)
    activeJobIdRef.value = 'job-2'
    await nextTick()

    // job-1 should have been completed
    expect(store.pendingResolve.has('job-1')).toBe(true)
    // job-2 should have started
    expect(store.inProgressItems.some((i) => i.jobId === 'job-2')).toBe(true)
  })

  it('two sequential runs: selection clears after each resolve', () => {
    const store = useLinearOutputStore()
    setJobWorkflowPath('job-1', 'workflows/test-workflow.json')
    setJobWorkflowPath('job-2', 'workflows/test-workflow.json')

    // Run 1: 3 outputs
    store.onJobStart('job-1')
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))
    store.onNodeExecuted(
      'job-1',
      makeExecutedDetail('job-1', [
        { filename: 'b.png', subfolder: '', type: 'output' }
      ])
    )
    store.onNodeExecuted(
      'job-1',
      makeExecutedDetail('job-1', [
        { filename: 'c.png', subfolder: '', type: 'output' }
      ])
    )

    const run1Images = store.inProgressItems.filter((i) => i.state === 'image')
    expect(run1Images).toHaveLength(3)

    store.onJobComplete('job-1')
    store.resolveIfReady('job-1', true)
    expect(store.selectedId).toBeNull()
    expect(store.inProgressItems).toHaveLength(0)

    // Simulate OutputHistory selecting run 1's first output (following latest)
    store.selectAsLatest('history:asset-run1:0')

    // Run 2: 3 outputs
    store.onJobStart('job-2')
    store.onNodeExecuted('job-2', makeExecutedDetail('job-2'))
    store.onNodeExecuted(
      'job-2',
      makeExecutedDetail('job-2', [
        { filename: 'e.png', subfolder: '', type: 'output' }
      ])
    )
    store.onNodeExecuted(
      'job-2',
      makeExecutedDetail('job-2', [
        { filename: 'f.png', subfolder: '', type: 'output' }
      ])
    )

    const run2Images = store.inProgressItems.filter((i) => i.state === 'image')
    expect(run2Images).toHaveLength(3)
    // Selection on run 2's latest output, not run 1's
    expect(store.selectedId).toBe(`slot:${run2Images[0].id}`)

    store.onJobComplete('job-2')
    store.resolveIfReady('job-2', true)

    // Must be null for history takeover — not a stale item
    expect(store.selectedId).toBeNull()
    expect(store.inProgressItems).toHaveLength(0)
  })

  it('keeps items visible across multiple resolveIfReady calls until loaded', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))
    store.onNodeExecuted(
      'job-1',
      makeExecutedDetail('job-1', [
        { filename: 'b.png', subfolder: '', type: 'output' }
      ])
    )
    store.onJobComplete('job-1')

    // History asset exists but outputs not loaded yet (async)
    store.resolveIfReady('job-1', false)
    expect(store.inProgressItems).toHaveLength(2)
    expect(store.pendingResolve.has('job-1')).toBe(true)

    // Still not loaded on next check
    store.resolveIfReady('job-1', false)
    expect(store.inProgressItems).toHaveLength(2)

    // Outputs finally loaded
    store.resolveIfReady('job-1', true)
    expect(store.inProgressItems).toHaveLength(0)
    expect(store.pendingResolve.has('job-1')).toBe(false)
  })

  it('does not remove in-progress items while history outputs are loading', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))
    store.onNodeExecuted(
      'job-1',
      makeExecutedDetail('job-1', [
        { filename: 'b.png', subfolder: '', type: 'output' }
      ])
    )
    store.onNodeExecuted(
      'job-1',
      makeExecutedDetail('job-1', [
        { filename: 'c.png', subfolder: '', type: 'output' }
      ])
    )
    store.onJobComplete('job-1')

    const itemCount = store.inProgressItems.length
    expect(itemCount).toBe(3)

    // History asset arrived but allOutputs() returns [] (still loading).
    // Caller passes false — items must stay visible to prevent a gap
    // where neither in-progress nor history items are rendered.
    store.resolveIfReady('job-1', false)
    expect(store.inProgressItems).toHaveLength(itemCount)

    // Once allOutputs() loads, caller passes true — safe to resolve
    store.resolveIfReady('job-1', true)
    expect(store.inProgressItems).toHaveLength(0)
  })

  it('discards latent previews for already-executed nodes', () => {
    vi.useFakeTimers()
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    // Node 1 sends latent then executes
    store.onLatentPreview('job-1', 'blob:node1-latent', '1')
    vi.advanceTimersByTime(16)
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1', undefined, '1'))

    // Stale latent for node 1 arrives after it already executed
    store.onLatentPreview('job-1', 'blob:node1-stale', '1')
    vi.advanceTimersByTime(16)

    // Should not create a new latent item for the executed node
    expect(
      store.inProgressItems.filter((i) => i.state === 'latent')
    ).toHaveLength(0)
    vi.useRealTimers()
  })

  it('accepts latent previews for new nodes after prior node executed', () => {
    vi.useFakeTimers()
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    // Node 1 executes
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1', undefined, '1'))

    // Node 2 sends latent preview — should be accepted
    store.onLatentPreview('job-1', 'blob:node2-latent', '2')
    vi.advanceTimersByTime(16)

    expect(
      store.inProgressItems.filter((i) => i.state === 'latent')
    ).toHaveLength(1)
    expect(store.inProgressItems[0].latentPreviewUrl).toBe('blob:node2-latent')
    vi.useRealTimers()
  })

  it('cancels pending RAF when a node executes', () => {
    vi.useFakeTimers()
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    // Latent preview scheduled in RAF
    store.onLatentPreview('job-1', 'blob:node1-latent')
    // Node executes before RAF fires — should cancel it
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1', undefined, '1'))
    vi.advanceTimersByTime(16)

    // Only the image item, no latent
    expect(
      store.inProgressItems.filter((i) => i.state === 'latent')
    ).toHaveLength(0)
    expect(
      store.inProgressItems.filter((i) => i.state === 'image')
    ).toHaveLength(1)
    vi.useRealTimers()
  })

  it('discards latent previews arriving after job completion', () => {
    vi.useFakeTimers()
    const store = useLinearOutputStore()
    store.onJobStart('job-1')
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))

    // Latent preview scheduled in RAF before job completes
    store.onLatentPreview('job-1', 'blob:late')
    store.onJobComplete('job-1')

    // RAF fires after completion — should be cancelled
    vi.advanceTimersByTime(16)

    // No new latent items should have been created
    expect(
      store.inProgressItems.filter((i) => i.state === 'latent')
    ).toHaveLength(0)
    vi.useRealTimers()
  })

  it('discards latent previews for completed job after RAF', () => {
    vi.useFakeTimers()
    const store = useLinearOutputStore()
    store.onJobStart('job-1')
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))
    store.onJobComplete('job-1')

    // Late preview arrives after job already completed
    store.onLatentPreview('job-1', 'blob:very-late')
    vi.advanceTimersByTime(16)

    expect(
      store.inProgressItems.filter((i) => i.state === 'latent')
    ).toHaveLength(0)
    vi.useRealTimers()
  })

  it('ignores executed events for other jobs', () => {
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    store.onNodeExecuted('job-other', makeExecutedDetail('job-other'))

    expect(store.inProgressItems.every((i) => i.state === 'skeleton')).toBe(
      true
    )
  })

  it('resets state when leaving app mode', async () => {
    const { nextTick } = await import('vue')
    const store = useLinearOutputStore()

    store.onJobStart('job-1')
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1'))
    store.select('slot:some-id')
    expect(store.inProgressItems.length).toBeGreaterThan(0)

    isAppModeRef.value = false
    await nextTick()

    expect(store.inProgressItems).toHaveLength(0)
    expect(store.selectedId).toBeNull()
    expect(store.pendingResolve.size).toBe(0)
  })

  it('does not show in-progress items from another workflow', () => {
    const store = useLinearOutputStore()

    // Job-1 submitted from workflow-a
    activeWorkflowPathRef.value = 'workflows/app-a.json'
    setJobWorkflowPath('job-1', 'workflows/app-a.json')
    store.onJobStart('job-1')

    // User switches to workflow-b: job-1 should NOT appear
    activeWorkflowPathRef.value = 'workflows/app-b.json'
    expect(store.activeWorkflowInProgressItems).toHaveLength(0)

    // Back on workflow-a: job-1 should appear
    activeWorkflowPathRef.value = 'workflows/app-a.json'
    expect(store.activeWorkflowInProgressItems).toHaveLength(1)
    expect(store.activeWorkflowInProgressItems[0].jobId).toBe('job-1')
  })

  it('uses executionStore path map for workflow scoping', () => {
    const store = useLinearOutputStore()

    // Simulate storeJob populating executionStore.jobIdToSessionWorkflowPath
    setJobWorkflowPath('job-1', 'workflows/app-a.json')
    setJobWorkflowPath('job-2', 'workflows/app-a.json')

    // User switches to workflow-b before execution starts
    activeWorkflowPathRef.value = 'workflows/app-b.json'

    store.onJobStart('job-1')
    store.onJobStart('job-2')

    // On workflow-b: neither job should appear
    expect(store.activeWorkflowInProgressItems).toHaveLength(0)

    // On workflow-a: both jobs should appear
    activeWorkflowPathRef.value = 'workflows/app-a.json'
    expect(store.activeWorkflowInProgressItems).toHaveLength(2)
  })

  it('scopes in-progress items per workflow with concurrent jobs', () => {
    vi.useFakeTimers()
    const store = useLinearOutputStore()

    // Job-1 on workflow-a (dog)
    activeWorkflowPathRef.value = 'workflows/app-a.json'
    setJobWorkflowPath('job-1', 'workflows/app-a.json')
    store.onJobStart('job-1')
    store.onLatentPreview('job-1', 'blob:dog')
    vi.advanceTimersByTime(16)

    // User switches to workflow-b, runs job-2
    activeWorkflowPathRef.value = 'workflows/app-b.json'
    setJobWorkflowPath('job-2', 'workflows/app-b.json')

    // Job-1 finishes, job-2 starts
    store.onJobComplete('job-1')
    store.onJobStart('job-2')
    store.onLatentPreview('job-2', 'blob:landscape')
    vi.advanceTimersByTime(16)

    // On workflow-b: should only see job-2 (landscape), NOT job-1 (dog)
    const items = store.activeWorkflowInProgressItems
    expect(items).toHaveLength(1)
    expect(items[0].jobId).toBe('job-2')
    expect(items[0].latentPreviewUrl).toBe('blob:landscape')
    vi.useRealTimers()
  })

  it('skips output items for nodes not in selectedOutputs', () => {
    selectedOutputsRef.value = ['2']
    const store = useLinearOutputStore()
    store.onJobStart('job-1')

    // Node 1 executes — not in selectedOutputs, should be skipped
    store.onNodeExecuted('job-1', makeExecutedDetail('job-1', undefined, '1'))

    // Skeleton should still be there (not consumed by non-output node)
    expect(
      store.inProgressItems.filter((i) => i.state === 'image')
    ).toHaveLength(0)

    // Node 2 executes — in selectedOutputs, should create image item
    store.onNodeExecuted(
      'job-1',
      makeExecutedDetail(
        'job-1',
        [{ filename: 'out.png', subfolder: '', type: 'output' }],
        '2'
      )
    )

    const imageItems = store.inProgressItems.filter((i) => i.state === 'image')
    expect(imageItems).toHaveLength(1)
    expect(imageItems[0].output?.nodeId).toBe('2')
  })

  it('does not auto-select for jobs belonging to another workflow', () => {
    const store = useLinearOutputStore()

    // User is on workflow-b, following latest
    activeWorkflowPathRef.value = 'workflows/app-b.json'
    store.selectAsLatest('history:asset-b:0')

    // Job from workflow-a starts
    setJobWorkflowPath('job-1', 'workflows/app-a.json')
    store.onJobStart('job-1')

    // Should NOT yank selection to the other workflow's slot
    expect(store.selectedId).toBe('history:asset-b:0')
  })

  it('auto-selects for jobs belonging to the active workflow', () => {
    const store = useLinearOutputStore()

    activeWorkflowPathRef.value = 'workflows/app-a.json'
    store.selectAsLatest('history:asset-a:0')

    setJobWorkflowPath('job-1', 'workflows/app-a.json')
    store.onJobStart('job-1')

    // Should auto-select since job matches active workflow
    expect(store.selectedId?.startsWith('slot:')).toBe(true)
  })

  it('ignores execution events when not in app mode', async () => {
    const { nextTick } = await import('vue')
    const store = useLinearOutputStore()

    isAppModeRef.value = false
    await nextTick()

    // Watcher-driven job start should be ignored
    activeJobIdRef.value = 'job-1'
    await nextTick()

    expect(store.inProgressItems).toHaveLength(0)
  })
})
