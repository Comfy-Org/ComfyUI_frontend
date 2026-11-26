/**
 * Shared primitives for building human-readable error/debug reports.
 *
 * Extracted from `crdtDebugReport.ts` (the strongest of the three report
 * builders identified in ADR-AGENT-ERRORS-0059) so other builders can reuse
 * the same code-fence escaping and surrogate-pair-safe truncation instead of
 * reimplementing weaker versions.
 */

/**
 * Wrap `body` in a markdown code fence using a delimiter long enough that it
 * cannot be prematurely closed by a run of backticks already present in the
 * body (e.g. a traceback or log line that itself contains a code fence).
 */
export function fence(language: string, body: string): string {
  const longestRun = [...body.matchAll(/`+/g)].reduce(
    (max, match) => Math.max(max, match[0].length),
    0
  )
  const delimiter = '`'.repeat(Math.max(3, longestRun + 1))
  return [delimiter + language, body, delimiter].join('\n')
}

/**
 * Truncate `text` to at most `max` characters, keeping the tail and dropping
 * the head. The cut point is nudged forward by one character if it would
 * otherwise split a UTF-16 surrogate pair.
 */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const start = text.length - max
  const safeStart =
    text.charCodeAt(start) >= 0xdc00 && text.charCodeAt(start) <= 0xdfff
      ? start + 1
      : start
  return `…(${safeStart} earlier characters trimmed)…\n${text.slice(safeStart)}`
}

/**
 * Truncate `text` to at most `maxLength` characters by keeping the head and
 * tail and dropping the middle, inserting a truncation marker between them.
 * Both cut points are nudged away from splitting a UTF-16 surrogate pair.
 */
export function truncateHeadAndTail(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const marker = `\n\n[report truncated to ${maxLength} characters]\n\n`
  const available = maxLength - marker.length
  const headLength = Math.floor(available * 0.75)
  const tailStart = text.length - (available - headLength)
  const safeHeadLength =
    text.charCodeAt(headLength - 1) >= 0xd800 &&
    text.charCodeAt(headLength - 1) <= 0xdbff
      ? headLength - 1
      : headLength
  const safeTailStart =
    text.charCodeAt(tailStart) >= 0xdc00 && text.charCodeAt(tailStart) <= 0xdfff
      ? tailStart + 1
      : tailStart
  return `${text.slice(0, safeHeadLength)}${marker}${text.slice(safeTailStart)}`
}
