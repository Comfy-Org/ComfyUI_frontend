import { cloneDeep } from 'es-toolkit/compat'
import type {
  IFuseOptions,
  FuseSortFunction,
  FuseSortFunctionArg
} from 'fuse.js'

import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

export const TEMPLATE_FUSE_SETTINGS_KEY = 'Comfy.Templates.FuseOverrides'

export type TemplateFuseSortMode = 'score' | 'exact' | 'prefix'
export type TemplateFuseGetMode = 'default' | 'flatten'

export interface TemplateFuseOptionState {
  isCaseSensitive: boolean
  ignoreDiacritics: boolean
  includeScore: boolean
  includeMatches: boolean
  minMatchCharLength: number
  shouldSort: boolean
  findAllMatches: boolean
  location: number
  threshold: number
  distance: number
  ignoreLocation: boolean
  useExtendedSearch: boolean
  ignoreFieldNorm: boolean
  fieldNormWeight: number
}

export interface TemplateFuseKeyConfig {
  path: string
  weight: number
}

export interface TemplateFuseConfig {
  options: TemplateFuseOptionState
  keys: TemplateFuseKeyConfig[]
  sortMode: TemplateFuseSortMode
  getFnMode: TemplateFuseGetMode
}

const DEFAULT_TEMPLATE_FUSE_OPTIONS: TemplateFuseOptionState = {
  isCaseSensitive: false,
  ignoreDiacritics: true,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 1,
  shouldSort: true,
  findAllMatches: false,
  location: 0,
  threshold: 0.4,
  distance: 100,
  ignoreLocation: false,
  useExtendedSearch: false,
  ignoreFieldNorm: false,
  fieldNormWeight: 1
}

const DEFAULT_TEMPLATE_FUSE_KEYS: TemplateFuseKeyConfig[] = [
  { path: 'name', weight: 0.3 },
  { path: 'title', weight: 0.3 },
  { path: 'description', weight: 0.2 },
  { path: 'tags', weight: 0.1 },
  { path: 'models', weight: 0.1 }
]

export const DEFAULT_TEMPLATE_FUSE_CONFIG: TemplateFuseConfig = {
  options: DEFAULT_TEMPLATE_FUSE_OPTIONS,
  keys: DEFAULT_TEMPLATE_FUSE_KEYS,
  sortMode: 'score',
  getFnMode: 'default'
}

type TemplateLike = TemplateInfo & {
  localizedTitle?: string
}

type BuildOptionsParams = {
  config?: TemplateFuseConfig | null
  query?: string
}

export function buildTemplateFuseOptions<T extends TemplateLike>(
  params?: BuildOptionsParams
): IFuseOptions<T> {
  const baseConfig = params?.config ?? DEFAULT_TEMPLATE_FUSE_CONFIG
  const normalizedKeys =
    baseConfig.keys.length > 0 ? baseConfig.keys : DEFAULT_TEMPLATE_FUSE_KEYS

  return {
    ...cloneDeep(baseConfig.options),
    keys: normalizedKeys.map((entry) => ({
      name: entry.path,
      weight: entry.weight
    })),
    getFn: buildGetFn<T>(baseConfig.getFnMode),
    sortFn: buildSortFn(baseConfig.sortMode, params?.query)
  }
}

function buildGetFn<T extends TemplateLike>(mode: TemplateFuseGetMode) {
  if (mode !== 'flatten') {
    return undefined
  }
  return (obj: T, path: string | string[]) => {
    if (Array.isArray(path)) {
      return path.map((segment) => stringifyValue(obj, segment))
    }
    return stringifyValue(obj, path)
  }
}

function stringifyValue(object: TemplateLike, path: string) {
  const raw = resolvePath(object, path)
  if (raw == null) return ''
  if (Array.isArray(raw)) {
    return raw
      .map((entry) =>
        typeof entry === 'string' ? entry : JSON.stringify(entry)
      )
      .join(' ')
  }
  if (typeof raw === 'object') {
    return Object.values(raw)
      .map((value) => (typeof value === 'string' ? value : ''))
      .join(' ')
  }
  return String(raw)
}

function resolvePath(object: TemplateLike, path: string) {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[segment]
    }
    return undefined
  }, object)
}

function buildSortFn(
  mode: TemplateFuseSortMode,
  query?: string
): FuseSortFunction | undefined {
  if (mode === 'score') {
    return undefined
  }
  const normalizedQuery = query?.toLowerCase().trim()
  return (a: FuseSortFunctionArg, b: FuseSortFunctionArg) => {
    const templateA = a.item as unknown as TemplateLike
    const templateB = b.item as unknown as TemplateLike
    if (!normalizedQuery) {
      return compareScores(a, b)
    }

    if (mode === 'exact') {
      const aExact = isExactMatch(templateA, normalizedQuery)
      const bExact = isExactMatch(templateB, normalizedQuery)
      if (aExact !== bExact) {
        return aExact ? -1 : 1
      }
      return compareScores(a, b)
    }

    const aPrefix = prefixScore(templateA, normalizedQuery)
    const bPrefix = prefixScore(templateB, normalizedQuery)
    if (aPrefix !== bPrefix) {
      return bPrefix - aPrefix
    }
    return compareScores(a, b)
  }
}

function compareScores(a: FuseSortFunctionArg, b: FuseSortFunctionArg) {
  const aScore = typeof a.score === 'number' ? a.score : 1
  const bScore = typeof b.score === 'number' ? b.score : 1
  return aScore - bScore
}

function isExactMatch(template: TemplateLike, query: string) {
  const title = formatTitle(template)
  const name = (template.name || '').toLowerCase()
  return title === query || name === query
}

function prefixScore(template: TemplateLike, query: string) {
  const title = formatTitle(template)
  const name = (template.name || '').toLowerCase()
  if (title.startsWith(query) || name.startsWith(query)) {
    return 2
  }
  if (title.includes(` ${query}`) || name.includes(` ${query}`)) {
    return 1
  }
  return 0
}

function formatTitle(template: TemplateLike) {
  return (
    template.localizedTitle ||
    template.title ||
    template.name ||
    ''
  ).toLowerCase()
}
