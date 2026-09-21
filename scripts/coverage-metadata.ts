import { existsSync, readFileSync } from 'node:fs'

/** Written alongside coverage.lcov by scripts/cicd/package-e2e-coverage.sh. */
export const COVERAGE_METADATA_FILE = 'coverage-metadata.json'

export interface CoverageMetadata {
  shardsFound: number
  shardsExpected: number
  complete: boolean
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
  if (!('shardsFound' in parsed) || typeof parsed.shardsFound !== 'number') {
    return null
  }
  if (
    !('shardsExpected' in parsed) ||
    typeof parsed.shardsExpected !== 'number'
  ) {
    return null
  }

  return {
    complete: parsed.complete,
    shardsFound: parsed.shardsFound,
    shardsExpected: parsed.shardsExpected
  }
}

export function readCoverageMetadata(
  filePath: string
): CoverageMetadata | null {
  if (!existsSync(filePath)) return null
  return parseCoverageMetadata(readFileSync(filePath, 'utf-8'))
}
