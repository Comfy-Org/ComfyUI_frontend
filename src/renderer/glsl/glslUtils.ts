/**
 * Parse `#pragma passes N` to get multi-pass count.
 * Mirrors backend _detect_pass_count() in nodes_glsl.py.
 */
export function detectPassCount(source: string): number {
  const match = source.match(/#pragma\s+passes\s+(\d+)/)
  if (match) return Math.max(1, parseInt(match[1], 10))
  return 1
}
