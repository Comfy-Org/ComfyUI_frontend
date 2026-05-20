import type { ResultItem } from '@/schemas/apiSchema'

function hasAnnotation(filepath: string): boolean {
  return /\[(input|output|temp)\]/i.test(filepath)
}

function createAnnotation(filepath: string, rootFolder = 'input'): string {
  return !hasAnnotation(filepath) && rootFolder !== 'input'
    ? ` [${rootFolder}]`
    : ''
}

function createPath(filename: string, subfolder = ''): string {
  return subfolder ? `${subfolder}/${filename}` : filename
}

/** Creates annotated filepath in format used by folder_paths.py */
export function createAnnotatedPath(
  item: string | ResultItem,
  options: { rootFolder?: string; subfolder?: string } = {}
): string {
  const { rootFolder = 'input', subfolder } = options
  if (typeof item === 'string')
    return `${createPath(item, subfolder)}${createAnnotation(item, rootFolder)}`
  return `${createPath(item.filename ?? '', item.subfolder)}${
    item.type && item.type !== rootFolder ? ` [${item.type}]` : ''
  }`
}
