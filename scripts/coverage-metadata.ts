import { existsSync, readFileSync } from 'node:fs'

/** Written alongside coverage.lcov by scripts/cicd/package-e2e-coverage.sh. */
export const COVERAGE_METADATA_FILE = 'coverage-metadata.json'

export interface CoverageMetadata {
  complete: boolean
  /** Commit the shards ran against, so a lagging baseline can name itself. */
  sourceSha?: string
}

export function parseCoverageMetadata(
  content: string
): CoverageMetadata | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  if (!('complete' in parsed) || typeof parsed.complete !== 'boolean') {
    return null
  }

  return {
    complete: parsed.complete,
    sourceSha:
      'sourceSha' in parsed &&
      typeof parsed.sourceSha === 'string' &&
      parsed.sourceSha
        ? parsed.sourceSha
        : undefined
  }
}

export function readCoverageMetadata(
  filePath: string
): CoverageMetadata | null {
  if (!existsSync(filePath)) return null
  return parseCoverageMetadata(readFileSync(filePath, 'utf-8'))
}

/**
 * CLI shim so the notify workflow gates its baseline on the same parser the
 * reporter uses, instead of a second hand-rolled one. Prints exactly `true`
 * or `false`: anything it cannot read as a whole merge prints `false`.
 */
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const complete = readCoverageMetadata(process.argv[2])?.complete === true
  process.stdout.write(String(complete))
}
