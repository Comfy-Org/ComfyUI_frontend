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
