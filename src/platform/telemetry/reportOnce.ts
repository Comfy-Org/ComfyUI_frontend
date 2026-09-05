/**
 * Guards a report against repetition: each distinct key reports once, and a
 * session reports at most `limit` distinct keys.
 *
 * Both bounds matter on paths a user can re-enter indefinitely — reloads, undo
 * and redo — where an unguarded reporter would send the same finding on every
 * pass and grow its key set for as long as the tab stays open. Give each kind
 * of finding its own reporter so a common one cannot spend a rare one's budget.
 */
export function createOnceReporter(
  limit: number
): (key: string, report: () => void) => void {
  const reported = new Set<string>()

  return (key, report) => {
    if (reported.has(key) || reported.size >= limit) return
    reported.add(key)
    report()
  }
}
