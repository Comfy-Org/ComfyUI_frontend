export const COVERAGE_OUTPUT_DIR = './coverage/playwright'

/**
 * Controls which source files are included in E2E coverage reports.
 * Matched against the full file path of each covered source.
 *
 * - Patterns are evaluated in order; the first match wins.
 * - `false` excludes; `true` includes.
 * - The catch-all entry at the end includes everything not excluded above.
 */
export const coverageSourceFilter: Readonly<Record<string, boolean>> = {
  '**/node_modules/**': false,
  '**/browser_tests/**': false,
  // Legacy DOM component library kept only for extension backwards-compat
  '**/src/scripts/ui.ts': false,
  '**/src/scripts/ui/**': false,
  '**/*': true
}
