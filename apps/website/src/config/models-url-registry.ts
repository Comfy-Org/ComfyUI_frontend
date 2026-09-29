import type { WorkshopDisplayEntry } from '../content/workshop-display.schema'
import {
  routerModelSlugAliases,
  workshopDisplayEntries,
  workshopModels
} from './workshop-browse-content'

const MODELS_BASE_PATH = '/models'

type PageKind = 'hub' | 'model' | 'workflow' | 'app' | 'reserved'

const navigableKinds: ReadonlySet<string> = new Set<PageKind>([
  'hub',
  'model',
  'workflow',
  'app'
])

export type ModelsUrlEntry =
  | { readonly path: string; readonly kind: PageKind }
  | {
      readonly path: string
      readonly kind: 'alias'
      readonly destination: string
    }

export type ModelsUrlKind = ModelsUrlEntry['kind']

export interface ModelsUrlRegistry {
  readonly roots: readonly string[]
  readonly entries: ReadonlyMap<string, ModelsUrlEntry>
}

interface ModelsUrlSources {
  readonly models: readonly string[]
  readonly workflows: readonly string[]
  readonly apps: readonly string[]
  readonly aliases: ReadonlyMap<string, string>
}

const withoutTrailingSlash = (pathname: string) => pathname.replace(/\/$/, '')

export function modelsUrlEntries(
  { models, workflows, apps, aliases }: ModelsUrlSources,
  base = MODELS_BASE_PATH
): ModelsUrlEntry[] {
  const root = withoutTrailingSlash(base)
  const at = (slug: string) => `${root}/${slug}`
  const page = (kind: PageKind) => (slug: string) => ({ path: at(slug), kind })
  return [
    { path: root, kind: 'hub' },
    ...['showcase', 'catalogue.json'].map(page('reserved')),
    ...models.map(page('model')),
    ...workflows.map(page('workflow')),
    ...apps.map(page('app')),
    ...[...models, ...workflows].map((slug) =>
      page('reserved')(`${slug}/page.json`)
    ),
    ...Array.from(aliases, ([slug, canonical]) => ({
      path: at(slug),
      kind: 'alias' as const,
      destination: at(canonical)
    }))
  ]
}

function assertOneHub(entries: readonly ModelsUrlEntry[]) {
  const hubs = entries.filter(({ kind }) => kind === 'hub').length
  if (hubs !== 1)
    throw new Error(`The registry needs exactly one hub, found ${hubs}`)
}

const isUnderRoots = (pathname: string, roots: readonly string[]) =>
  roots.some((root) => pathname === root || pathname.startsWith(`${root}/`))

export function buildModelsUrlRegistry(
  entries: readonly ModelsUrlEntry[],
  roots: readonly string[]
): ModelsUrlRegistry {
  assertOneHub(entries)
  const normalizedRoots = roots.map(withoutTrailingSlash)
  const registry = new Map<string, ModelsUrlEntry>()
  for (const entry of entries) {
    const path = withoutTrailingSlash(entry.path)
    if (!isUnderRoots(path, normalizedRoots))
      throw new Error(`${path} is outside ${normalizedRoots.join(', ')}`)
    const claimed = registry.get(path)
    if (claimed)
      throw new Error(
        `${path} is registered twice, as ${claimed.kind} and as ${entry.kind}`
      )
    registry.set(
      path,
      entry.kind === 'alias'
        ? {
            ...entry,
            path,
            destination: withoutTrailingSlash(entry.destination)
          }
        : { ...entry, path }
    )
  }
  for (const entry of registry.values()) {
    if (entry.kind !== 'alias') continue
    const target = registry.get(entry.destination)
    if (!target || !navigableKinds.has(target.kind))
      throw new Error(
        `${entry.path} redirects to ${entry.destination}, which is not a registered page`
      )
  }
  return { roots: normalizedRoots, entries: registry }
}

const slugsOfType = (types: readonly WorkshopDisplayEntry['type'][]) =>
  workshopDisplayEntries
    .filter((entry) => types.includes(entry.type))
    .map(({ slug }) => slug)

const modelsUrlRegistry = buildModelsUrlRegistry(
  modelsUrlEntries({
    models: workshopModels.map(({ slug }) => slug),
    workflows: slugsOfType(['CLOUD', 'SERVERLESS']),
    apps: slugsOfType(['APP']),
    aliases: routerModelSlugAliases
  }),
  [MODELS_BASE_PATH]
)

export function modelsUrlKind(
  pathname: string,
  registry: ModelsUrlRegistry = modelsUrlRegistry
): ModelsUrlKind | undefined {
  return registry.entries.get(withoutTrailingSlash(pathname))?.kind
}

/** Built pages under the registry's roots that no entry claims. */
export function unregisteredModelsPaths(
  pathnames: readonly string[],
  registry: ModelsUrlRegistry = modelsUrlRegistry
): string[] {
  return pathnames
    .map((pathname) =>
      withoutTrailingSlash(`/${pathname}`.replace(/^\/+/, '/'))
    )
    .filter(
      (pathname) =>
        isUnderRoots(pathname, registry.roots) &&
        modelsUrlKind(pathname, registry) === undefined
    )
}
