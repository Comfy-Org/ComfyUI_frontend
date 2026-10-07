import { z } from 'zod'

const manifestSchema = z
  .object({
    version: z.literal(1),
    files: z.record(
      z.string(),
      z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)
    ),
    knownViolations: z.record(z.string(), z.array(z.string())).optional()
  })
  .strict()

export type SourceManifest = z.infer<typeof manifestSchema>

export function serializeManifest({
  files,
  knownViolations
}: SourceManifest): string {
  const manifest = {
    files: Object.fromEntries(
      Object.entries(files).sort(([a], [b]) => a.localeCompare(b))
    ),
    ...(knownViolations && Object.keys(knownViolations).length
      ? { knownViolations }
      : {}),
    version: 1
  }
  return `${JSON.stringify(manifest, null, 2)}\n`
}

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
