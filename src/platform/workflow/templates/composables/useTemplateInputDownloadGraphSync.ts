import type { ComfyTemplateInputDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'

interface TemplateInputDownloadGraphSyncDependencies {
  getReferencedInputNames: () => ReadonlySet<string>
  refreshGraphBindings: (completedInputNames: string[]) => Promise<void>
  reportError: (error: unknown) => void
}

function createTemplateInputDownloadGraphSync({
  getReferencedInputNames,
  refreshGraphBindings,
  reportError
}: TemplateInputDownloadGraphSyncDependencies) {
  const completedInputNames = new Set<string>()
  let disposed = false
  /**
   * Read through a call rather than the binding. The early return in
   * `syncCurrentGraph` narrows `disposed` to `false` for the rest of that
   * function, but the loop below resumes after an await, by which point
   * `dispose` may have flipped it.
   */
  const isDisposed = () => disposed
  let scheduled = false
  let rerunRequested = false
  let inFlight: Promise<void> | null = null

  async function flushCurrentGraph() {
    const referenced = getReferencedInputNames()
    const matched = [...completedInputNames].filter((filename) =>
      referenced.has(filename)
    )
    if (!matched.length) return

    try {
      await refreshGraphBindings(matched)
    } catch (error) {
      reportError(error)
      // The rebind failed, and its caller has already released these from the
      // download store. Holding them here would keep matching them on every
      // later sync without anything able to retry, so drop them.
      for (const filename of matched) completedInputNames.delete(filename)
      return
    }

    const currentReferences = getReferencedInputNames()
    for (const filename of matched) {
      if (currentReferences.has(filename)) completedInputNames.delete(filename)
    }
  }

  function scheduleSync() {
    if (disposed || scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      if (!disposed) void syncCurrentGraph()
    })
  }

  function syncCurrentGraph(): Promise<void> {
    if (disposed) return Promise.resolve()
    if (inFlight) {
      rerunRequested = true
      return inFlight
    }

    // Reruns are awaited as part of this promise. Scheduling them separately
    // let the promise resolve before the graph had been reconciled, so a
    // caller could report a template as open against stale bindings.
    const trackedRun = (async () => {
      await flushCurrentGraph()
      while (rerunRequested && !isDisposed()) {
        rerunRequested = false
        await flushCurrentGraph()
      }
    })().finally(() => {
      if (inFlight === trackedRun) inFlight = null
    })
    inFlight = trackedRun
    return trackedRun
  }

  function handleProgress(progress: ComfyTemplateInputDownloadProgress) {
    if (progress.status !== 'completed') return
    completedInputNames.add(progress.filename)
    scheduleSync()
  }

  function dispose() {
    disposed = true
  }

  return { handleProgress, syncCurrentGraph, dispose }
}

type TemplateInputDownloadGraphSync = ReturnType<
  typeof createTemplateInputDownloadGraphSync
>

let activeGraphSync: TemplateInputDownloadGraphSync | null = null

export function startTemplateInputDownloadGraphSync(
  dependencies: TemplateInputDownloadGraphSyncDependencies
) {
  activeGraphSync?.dispose()
  const graphSync = createTemplateInputDownloadGraphSync(dependencies)
  activeGraphSync = graphSync

  return {
    handleProgress: graphSync.handleProgress,
    syncCurrentGraph: graphSync.syncCurrentGraph,
    dispose() {
      graphSync.dispose()
      if (activeGraphSync === graphSync) activeGraphSync = null
    }
  }
}

export function syncCompletedTemplateInputsWithCurrentGraph(): Promise<void> {
  return activeGraphSync?.syncCurrentGraph() ?? Promise.resolve()
}
