import type { ResultItemType } from '@/schemas/apiSchema'

export function getResourceURL(
  subfolder: string,
  filename: string,
  type: ResultItemType = 'input'
): string {
  const params = [
    'filename=' + encodeURIComponent(filename),
    'type=' + type,
    'subfolder=' + subfolder
  ].join('&')

  return `/view?${params}`
}

export function splitFilePath(path: string): [string, string] {
  const folder_separator = path.lastIndexOf('/')
  if (folder_separator === -1) {
    return ['', path]
  }
  return [
    path.substring(0, folder_separator),
    path.substring(folder_separator + 1)
  ]
}
