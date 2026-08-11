import type { ResultItem, ResultItemType } from '@/schemas/apiSchema'

const IMPLICIT_ASSET_ROOT = 'input'

const hasAnnotation = (filepath: string): boolean =>
  /\[(input|output|temp)\]/i.test(filepath)

const createAnnotation = (
  filepath: string,
  rootFolder = IMPLICIT_ASSET_ROOT
): string =>
  !hasAnnotation(filepath) && rootFolder !== IMPLICIT_ASSET_ROOT
    ? ` [${rootFolder}]`
    : ''

const createPath = (filename: string, subfolder = ''): string =>
  subfolder ? `${subfolder}/${filename}` : filename

type AnnotatedPathOptions = {
  rootFolder?: ResultItemType
  subfolder?: string
}

const ANNOTATION_SUFFIX = /\s*\[(input|output|temp)\]\s*$/i

/**
 * Inverse of {@link createAnnotatedPath}: splits an annotated filepath back
 * into its path and the root folder the annotation names.
 *
 * `createAnnotatedPath` omits the annotation for the implicit `input` root, so
 * an unannotated path is indistinguishable from an `input` one and resolves to
 * `fallbackRoot`.
 */
export function parseAnnotatedPath(
  filepath: string,
  fallbackRoot: ResultItemType = IMPLICIT_ASSET_ROOT
): { filepath: string; rootFolder: ResultItemType } {
  const match = ANNOTATION_SUFFIX.exec(filepath)
  if (!match) return { filepath, rootFolder: fallbackRoot }
  return {
    filepath: filepath.slice(0, match.index),
    rootFolder: match[1].toLowerCase() as ResultItemType
  }
}

/** Creates annotated filepath in format used by folder_paths.py */
export function createAnnotatedPath(item: ResultItem): string
export function createAnnotatedPath(
  item: string,
  options?: AnnotatedPathOptions
): string
export function createAnnotatedPath(
  item: string | ResultItem,
  options: AnnotatedPathOptions = {}
): string {
  const { rootFolder = IMPLICIT_ASSET_ROOT, subfolder } = options
  if (typeof item === 'string')
    return `${createPath(item, subfolder)}${createAnnotation(item, rootFolder)}`
  const filename = item.filename ?? ''
  return `${createPath(filename, item.subfolder)}${createAnnotation(
    filename,
    item.type
  )}`
}
