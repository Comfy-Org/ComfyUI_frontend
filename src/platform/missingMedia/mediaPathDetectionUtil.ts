// Missing-media-scoped helpers for deriving comparison keys from media widget paths.
const CORE_ANNOTATED_MEDIA_PATTERN = /\s+\[(input|output)\]$/
const CLOUD_ANNOTATED_MEDIA_PATTERN = /\s*\[(input|output)\]$/

type AnnotatedMediaPathType = 'input' | 'output'

interface AnnotatedMediaPathOptions {
  allowCompactSuffix?: boolean
}

function getAnnotatedMediaPathMatch(
  value: string,
  options: AnnotatedMediaPathOptions = {}
): RegExpMatchArray | null {
  const pattern = options.allowCompactSuffix
    ? CLOUD_ANNOTATED_MEDIA_PATTERN
    : CORE_ANNOTATED_MEDIA_PATTERN
  return value.match(pattern)
}

export function getAnnotatedMediaPathTypeForDetection(
  value: string,
  options: AnnotatedMediaPathOptions = {}
): AnnotatedMediaPathType | undefined {
  return getAnnotatedMediaPathMatch(value, options)?.[1] as
    | AnnotatedMediaPathType
    | undefined
}

export function normalizeAnnotatedMediaPathForDetection(
  value: string,
  options: AnnotatedMediaPathOptions = {}
): string {
  const match = getAnnotatedMediaPathMatch(value, options)
  return match ? value.slice(0, match.index) : value
}

export function getMediaPathDetectionNames(
  value: string,
  options: AnnotatedMediaPathOptions = {}
): string[] {
  const normalized = normalizeAnnotatedMediaPathForDetection(value, options)
  return normalized === value ? [value] : [value, normalized]
}
