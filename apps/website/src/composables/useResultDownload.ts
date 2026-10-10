import type { Ref } from 'vue'
import { computed } from 'vue'

interface Finished {
  kind: 'done'
  result: { url: string }
}

function isFinished<P extends { kind: string }>(
  phase: P
): phase is Extract<P, Finished> {
  return phase.kind === 'done'
}

/** The editor header's Download file: the finished result, named by the app. */
export function useResultDownload<P extends { kind: string }>(
  phase: Readonly<Ref<P>>,
  name: (finished: Extract<P, Finished>) => string | undefined
) {
  return computed(() => {
    const current = phase.value
    if (!isFinished(current)) return undefined
    const file = name(current)
    return file ? { href: current.result.url, name: file } : undefined
  })
}
