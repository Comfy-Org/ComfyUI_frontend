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
  readonly base: string
  readonly entries: ReadonlyMap<string, ModelsUrlEntry>
}

interface ModelsUrlSources {
  readonly models: readonly string[]
  readonly workflows: readonly string[]
  readonly apps: readonly string[]
  readonly aliases: ReadonlyMap<string, string>
}

export function modelsUrlEntries(
  { models, workflows, apps, aliases }: ModelsUrlSources,
  base = MODELS_BASE_PATH
): ModelsUrlEntry[] {
  const at = (slug: string) => `${base}/${slug}`
  const page = (kind: PageKind) => (slug: string) => ({ path: at(slug), kind })
  return [
    { path: base, kind: 'hub' },
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

const withoutTrailingSlash = (pathname: string) => pathname.replace(/\/$/, '')

function hubPath(entries: readonly ModelsUrlEntry[]): string {
  const hubs = entries.filter(({ kind }) => kind === 'hub')
  if (hubs.length !== 1)
    throw new Error(`The registry needs exactly one hub, found ${hubs.length}`)
  return withoutTrailingSlash(hubs[0].path)
}

export function buildModelsUrlRegistry(
  entries: readonly ModelsUrlEntry[]
): ModelsUrlRegistry {
  const base = hubPath(entries)
  const registry = new Map<string, ModelsUrlEntry>()
  for (const entry of entries) {
    const path = withoutTrailingSlash(entry.path)
    if (path !== base && !path.startsWith(`${base}/`))
      throw new Error(`${path} is outside the ${base} hub`)
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
  return { base, entries: registry }
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
  })
)

export function modelsUrlKind(
  pathname: string,
  registry: ModelsUrlRegistry = modelsUrlRegistry
): ModelsUrlKind | undefined {
  return registry.entries.get(withoutTrailingSlash(pathname))?.kind
}

/** Built pages under the registry's hub that no entry claims. */
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
        pathname.startsWith(`${registry.base}/`) &&
        modelsUrlKind(pathname, registry) === undefined
    )
}
