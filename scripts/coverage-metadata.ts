import { existsSync, readFileSync } from 'node:fs'

/** Written alongside coverage.lcov by scripts/cicd/package-e2e-coverage.sh. */
export const COVERAGE_METADATA_FILE = 'coverage-metadata.json'

export interface CoverageMetadata {
  complete: boolean
  /** Present for the warning text only; never gates the trust decision. */
  shardsFound?: number
  shardsExpected?: number
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
    shardsFound:
      'shardsFound' in parsed && typeof parsed.shardsFound === 'number'
        ? parsed.shardsFound
        : undefined,
    shardsExpected:
      'shardsExpected' in parsed && typeof parsed.shardsExpected === 'number'
        ? parsed.shardsExpected
        : undefined
  }
}

export function readCoverageMetadata(
  filePath: string
): CoverageMetadata | null {
  if (!existsSync(filePath)) return null
  return parseCoverageMetadata(readFileSync(filePath, 'utf-8'))
}
