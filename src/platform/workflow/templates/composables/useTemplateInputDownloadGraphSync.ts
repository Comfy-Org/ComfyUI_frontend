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
      // Keep the names: the files are on disk, and the next sync - another
      // completion or another template opening - is the only thing that can
      // rebind them.
      reportError(error)
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

    // Reruns stay inside this awaited block so callers do not continue before
    // every requested refresh attempt has settled.
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
