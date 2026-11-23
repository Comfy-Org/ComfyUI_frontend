import { defineStore } from 'pinia'

import type { VersionHost } from './shared/versionHost'
import { useComfyApiStore } from './v4/comfyApiStore'

/** The host's one door into the node API: each call reaches every published version, oldest first. */
export const useNodeApiHost = defineStore('nodeApiHost', () =>
  createNodeApiHost([useComfyApiStore()])
)

/** Fans each host call out to `versions`, in order. */
export function createNodeApiHost(versions: readonly VersionHost[]) {
  const each = (call: (version: VersionHost) => void) => versions.forEach(call)

  return {
    publish: () => each((version) => version.publish()),
    markReady: () => each((version) => version.markReady()),
    providePacks: (served: Parameters<VersionHost['providePacks']>[0]) =>
      each((version) => version.providePacks(served)),
    endDocument: (graph: Parameters<VersionHost['endDocument']>[0]) =>
      each((version) => version.endDocument(graph)),
    beginDocument: () => each((version) => version.beginDocument()),
    beforeHistoryRestore: (
      state: Parameters<VersionHost['beforeHistoryRestore']>[0]
    ) => each((version) => version.beforeHistoryRestore(state)),
    afterHistoryRestore: () => each((version) => version.afterHistoryRestore()),
    reapplyTypeColors: () => each((version) => version.reapplyTypeColors())
  }
}
