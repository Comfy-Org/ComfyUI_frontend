import { defineStore } from 'pinia'

import type { VersionHost } from './shared/versionHost'
import { useComfyApiStore } from './v4/comfyApiStore'

/** The host's one door into the node API: each call reaches every published version, oldest first. */
export const useNodeApiHost = defineStore('nodeApiHost', () =>
  createNodeApiHost([useComfyApiStore()])
)

type Notice = {
  [K in keyof VersionHost]: VersionHost[K] extends (...args: never[]) => void
    ? K
    : never
}[keyof VersionHost]

/** Fans each host call out to `versions`, in order. */
export function createNodeApiHost(versions: readonly VersionHost[]) {
  const toEach =
    <K extends Notice>(call: K) =>
    (...args: Parameters<VersionHost[K]>) => {
      for (const version of versions)
        Reflect.apply(version[call], version, args)
    }

  return {
    publish: toEach('publish'),
    markReady: toEach('markReady'),
    providePacks: toEach('providePacks'),
    endDocument: toEach('endDocument'),
    beginDocument: toEach('beginDocument'),
    beforeHistoryRestore: toEach('beforeHistoryRestore'),
    afterHistoryRestore: toEach('afterHistoryRestore'),
    reapplyTypeColors: toEach('reapplyTypeColors')
  } satisfies VersionHost
}
