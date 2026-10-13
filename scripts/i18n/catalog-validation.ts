import { baseCompile } from '@intlify/message-compiler'

import type { LocaleObject, LocaleValue } from './locale-tree'
import { pathKey } from './locale-tree'

function isRawNodeTooltip(filename: string, path: readonly string[]): boolean {
  return (
    filename === 'nodeDefs.json' &&
    path.length === 4 &&
    ['inputs', 'outputs'].includes(path[1]) &&
    path[3] === 'tooltip'
  )
}

function hasUnsafeHtml(value: string): boolean {
  return (
    /<(?:script|iframe|object|embed|style|base|link|meta)(?:\s|\/?>)/i.test(
      value
    ) ||
    /<[^>]+\s(?:on[a-z]+\s*=|(?:href|src)\s*=\s*["']?\s*(?:javascript|vbscript|data):)/i.test(
      value
    )
  )
}

function messageErrors(value: string, path: readonly string[]): string[] {
  const errors: string[] = []
  baseCompile(/\{\s*$/.test(value) ? `${value}catalogEnd` : value, {
    onError: (error) =>
      errors.push(`${path.join('.')}: invalid message: ${error.message}`)
  })
  if (hasUnsafeHtml(value)) errors.push(`${path.join('.')}: unsafe HTML`)
  return errors
}

export function auditCatalogSafety(
  catalog: LocaleObject,
  filename: string,
  skipKeys: ReadonlySet<string> = new Set()
): string[] {
  function visit(value: LocaleValue, path: string[]): string[] {
    if (skipKeys.has(pathKey(path))) return []
    if (typeof value === 'string')
      return isRawNodeTooltip(filename, path) ? [] : messageErrors(value, path)
    if (value === null || typeof value !== 'object') return []
    return Object.entries(value).flatMap(([key, child]) =>
      visit(child, [...path, key])
    )
  }
  return visit(catalog, [])
}
