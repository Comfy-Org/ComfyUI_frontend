import type { ResultItem } from '@/schemas/apiSchema'

const hasAnnotation = (type: string): boolean =>
  /\[(input|output|temp)\]/i.test(type)

const createAnnotation = (type: string, rootType: string = 'input'): string =>
  !hasAnnotation(type) && type !== rootType ? ` [${type}]` : ''

const createPath = (filename: string, subfolder = ''): string =>
  subfolder ? `${subfolder}/${filename}` : filename

/** Creates annotated filepath in format used by folder_paths.py */
export function createAnnotatedPath(
  item: string | ResultItem,
  options: { rootFolder?: string; subfolder?: string } = {}
): string {
  const { rootFolder = 'input', subfolder } = options
  if (typeof item === 'string')
    return `${createPath(item, subfolder)}${createAnnotation(item, rootFolder)}`
  return `${createPath(item.filename ?? '', item.subfolder)}${
    item.type ? createAnnotation(item.type, rootFolder) : ''
  }`
}
