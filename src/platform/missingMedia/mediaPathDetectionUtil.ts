// Missing-media-scoped helpers for deriving comparison keys from media widget paths.
const ANNOTATED_MEDIA_PATTERN = /\s+\[(input|output)\]$/

type AnnotatedMediaPathType = 'input' | 'output'

export function getAnnotatedMediaPathTypeForDetection(
  value: string
): AnnotatedMediaPathType | undefined {
  return value.match(ANNOTATED_MEDIA_PATTERN)?.[1] as
    | AnnotatedMediaPathType
    | undefined
}

export function normalizeAnnotatedMediaPathForDetection(value: string): string {
  const match = value.match(ANNOTATED_MEDIA_PATTERN)
  return match ? value.slice(0, match.index) : value
}

export function getMediaPathDetectionNames(value: string): string[] {
  const normalized = normalizeAnnotatedMediaPathForDetection(value)
  return normalized === value ? [value] : [value, normalized]
}
