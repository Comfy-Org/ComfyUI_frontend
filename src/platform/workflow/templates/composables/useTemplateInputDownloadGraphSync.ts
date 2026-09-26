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

    const currentRun = flushCurrentGraph()
    const trackedRun = currentRun.finally(() => {
      if (inFlight === trackedRun) inFlight = null
      if (rerunRequested) {
        rerunRequested = false
        scheduleSync()
      }
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
