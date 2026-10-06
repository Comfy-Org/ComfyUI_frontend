import { z } from 'zod'

import type { TokenViolation } from './protected-tokens'
import { violationCodes } from './protected-tokens'

const fileSnapshotSchema = z
  .object({
    locales: z.record(
      z.string(),
      z.object({ reviewNeeded: z.array(z.array(z.string())) }).strict()
    ),
    knownViolations: z.array(
      z
        .object({
          locale: z.string(),
          path: z.array(z.string()),
          code: z.enum(violationCodes),
          token: z.string()
        })
        .strict()
    )
  })
  .strict()

const manifestSchema = z
  .object({
    version: z.literal(2),
    files: z.record(z.string(), fileSnapshotSchema)
  })
  .strict()

export type SourceManifest = z.infer<typeof manifestSchema>
export type FileSnapshot = SourceManifest['files'][string]

function describeError(error: unknown): string {
  if (!(error instanceof z.ZodError)) return String(error)
  return error.issues
    .map(({ path, message }) => `${JSON.stringify(path)}: ${message}`)
    .join('; ')
}

export function loadManifest(
  filename: string,
  content: string
): SourceManifest {
  try {
    return manifestSchema.parse(JSON.parse(content))
  } catch (error) {
    throw new Error(
      `Cannot load source manifest ${filename} (${describeError(error)}). Restore it from git history.`,
      { cause: error }
    )
  }
}

export function splitViolations(
  actual: readonly TokenViolation[],
  baseline: readonly TokenViolation[]
): {
  known: TokenViolation[]
  unexpected: TokenViolation[]
  stale: TokenViolation[]
} {
  const remaining = [...baseline]
  const known: TokenViolation[] = []
  const unexpected: TokenViolation[] = []
  for (const violation of actual) {
    const index = remaining.findIndex(
      (entry) =>
        entry.code === violation.code &&
        entry.token === violation.token &&
        JSON.stringify(entry.path) === JSON.stringify(violation.path)
    )
    if (index === -1) unexpected.push(violation)
    else {
      known.push(violation)
      remaining.splice(index, 1)
    }
  }
  return { known, unexpected, stale: remaining }
}
