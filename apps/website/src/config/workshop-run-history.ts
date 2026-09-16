import type { RunRecord } from './workshop-run'

const MAX_RUNS = 5
const MAX_RETAINED_BYTES = 64 * 1024 * 1024

export function retainRunHistory(runs: readonly RunRecord[]) {
  let bytes = 0
  let count = 0
  for (const run of runs) {
    const size = [run.output, ...run.attachments].reduce(
      (sum, output) => sum + (output.byteLength ?? 0),
      0
    )
    if (count > 0 && (count === MAX_RUNS || bytes + size > MAX_RETAINED_BYTES))
      break
    bytes += size
    count += 1
  }
  return { retained: runs.slice(0, count), discarded: runs.slice(count) }
}
