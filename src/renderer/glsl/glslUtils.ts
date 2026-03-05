/**
 * Detect how many fragColor outputs are used in a GLSL shader source.
 * Mirrors backend _detect_output_count() in nodes_glsl.py.
 */
export function detectOutputCount(source: string): number {
  const matches = source.match(/fragColor(\d+)/g)
  if (!matches) return 1

  let maxIndex = 0
  for (const match of matches) {
    const index = parseInt(match.replace('fragColor', ''), 10)
    if (index > maxIndex) maxIndex = index
  }
  return Math.min(maxIndex + 1, 4)
}

/**
 * Parse `#pragma passes N` to get multi-pass count.
 * Mirrors backend _detect_pass_count() in nodes_glsl.py.
 */
export function detectPassCount(source: string): number {
  const match = source.match(/#pragma\s+passes\s+(\d+)/)
  if (match) return Math.max(1, parseInt(match[1], 10))
  return 1
}

/**
 * Check if a shader source string contains a GLSL ES 3.00 version directive.
 */
export function hasVersionDirective(source: string): boolean {
  return /^#version\s+300\s+es\s*$/m.test(source)
}
