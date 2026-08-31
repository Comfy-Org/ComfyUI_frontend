/**
 * Counts deprecation warnings, attributed to the code that triggered them.
 *
 * This is the primary evidence that a conversion worked, so its failure modes
 * matter more than its happy path. Two are load-bearing:
 *
 * 1. **`warnDeprecated` dedupes by message for the whole session.** Counting a
 *    before-run and then an after-run naively would show the after-run at zero
 *    *because the before-run already consumed the message* — reporting a
 *    successful conversion that never happened. The recorder forces
 *    `alwaysRepeatWarnings` on for its lifetime.
 * 2. **Zero is ambiguous.** No warnings can mean "converted" or "that code never
 *    ran". Callers must compare against a non-zero baseline; `verdict.ts`
 *    enforces that, and this module reports enough detail to tell them apart.
 */
import { LiteGraph } from '@/lib/litegraph/src/litegraph'

interface DeprecationRecord {
  readonly message: string
  /** Stack at the point of warning, when the runtime provides one. */
  readonly stack: string | undefined
}

interface Recording {
  readonly all: readonly DeprecationRecord[]
  /** Records whose stack mentions `attribution`. */
  readonly attributed: readonly DeprecationRecord[]
  readonly count: number
}

export interface RecorderOptions {
  /**
   * Substring identifying the code under test — a pack id or module path.
   * Warnings raised by core while merely *servicing* the pack are excluded, so
   * the count reflects what the pack itself still touches.
   */
  readonly attribution?: string
}

export interface Recorder {
  stop(): Recording
}

/**
 * Starts recording. Always pair with `stop()`, which restores global state.
 */
export function recordDeprecations(options: RecorderOptions = {}): Recorder {
  const records: DeprecationRecord[] = []

  const previousRepeat = LiteGraph.alwaysRepeatWarnings
  // Without this the second run of a before/after pair silently reports zero.
  LiteGraph.alwaysRepeatWarnings = true

  const callback = (message: string) => {
    records.push({ message, stack: new Error(message).stack })
  }
  LiteGraph.onDeprecationWarning.push(callback)

  return {
    stop(): Recording {
      const index = LiteGraph.onDeprecationWarning.indexOf(callback)
      if (index !== -1) LiteGraph.onDeprecationWarning.splice(index, 1)
      LiteGraph.alwaysRepeatWarnings = previousRepeat

      const attribution = options.attribution
      const attributed = attribution
        ? records.filter((r) => r.stack?.includes(attribution))
        : records

      return {
        all: Object.freeze([...records]),
        attributed: Object.freeze(attributed),
        count: attributed.length
      }
    }
  }
}
