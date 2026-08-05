import { t, te } from '@/i18n'

// Shared i18n helpers for error catalog resolvers. These preserve the raw API
// message/details as fallbacks when a catalog key is not available. Keep this
// module folder-internal so UI code only consumes resolved display fields.
export interface ErrorResolveContext {
  isCloud?: boolean
  nodeDisplayName?: string
}

export type CatalogParams = Record<string, string | number>

export function translateCatalogMessage(
  key: string,
  fallback: string,
  params?: CatalogParams
): string {
  if (te(key))
    return params ? t(key, params, { escapeParameter: false }) : t(key)
  if (!params) return fallback

  return fallback.replace(/\{(\w+)\}/g, (match, paramName) =>
    params[paramName] === undefined ? match : String(params[paramName])
  )
}

export function translateOptionalCatalogMessage(
  key: string,
  fallback?: string,
  params?: CatalogParams
): string | undefined {
  if (te(key))
    return params ? t(key, params, { escapeParameter: false }) : t(key)
  return fallback?.trim() ? fallback : undefined
}

export function normalizeNodeName(nodeDisplayName: string | undefined): string {
  return (
    nodeDisplayName?.trim() ||
    translateCatalogMessage('errorCatalog.fallbacks.nodeName', 'This node')
  )
}
