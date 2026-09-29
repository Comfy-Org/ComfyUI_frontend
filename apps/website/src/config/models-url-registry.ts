import displayJson from '../content/workshop-display.json'
import type { WorkshopDisplayEntry } from '../content/workshop-display.schema'
import { workshopDisplayEntriesSchema } from '../content/workshop-display.schema'
import { HUB_MODELS_PATH, hubModelAliases, hubModelSlugs } from './hub-models'

const MODELS_BASE_PATH = '/models'

type PageKind = 'hub' | 'model' | 'workflow' | 'app' | 'reserved'

export type ModelsUrlEntry =
  | { readonly path: string; readonly kind: PageKind }
  | {
      readonly path: string
      readonly kind: 'alias'
      readonly destination: string
    }

export type ModelsUrlKind = ModelsUrlEntry['kind']

export type ModelsUrlRegistry = ReadonlyMap<string, ModelsUrlEntry>

interface ModelsUrlSources {
  /** Old page id under `/models` → its slug under `/hub/models`. */
  readonly models: ReadonlyMap<string, string>
  readonly workflows: readonly string[]
  readonly apps: readonly string[]
  /** Old alias under `/models` → the slug under `/hub/models` it serves. */
  readonly aliases: ReadonlyMap<string, string>
}

export function modelsUrlEntries({
  models,
  workflows,
  apps,
  aliases
}: ModelsUrlSources): ModelsUrlEntry[] {
  const at = (slug: string) => `${MODELS_BASE_PATH}/${slug}`
  const atHub = (slug: string) => `${HUB_MODELS_PATH}/${slug}`
  const page = (kind: PageKind) => (slug: string) => ({ path: at(slug), kind })
  const redirect = ([slug, hubSlug]: readonly [string, string]) => ({
    path: at(slug),
    kind: 'alias' as const,
    destination: atHub(hubSlug)
  })
  return [
    { path: HUB_MODELS_PATH, kind: 'hub' },
    {
      path: MODELS_BASE_PATH,
      kind: 'alias',
      destination: HUB_MODELS_PATH
    },
    ...['showcase', 'catalogue.json'].map(page('reserved')),
    ...Array.from(models.values(), (slug) => ({
      path: atHub(slug),
      kind: 'model' as const
    })),
    ...workflows.map(page('workflow')),
    ...apps.map(page('app')),
    ...[...models.keys(), ...workflows].map((slug) =>
      page('reserved')(`${slug}/page.json`)
    ),
    ...Array.from(models, redirect),
    ...Array.from(aliases, redirect)
  ]
}

const withoutTrailingSlash = (pathname: string) => pathname.replace(/\/$/, '')

export function buildModelsUrlRegistry(
  entries: readonly ModelsUrlEntry[]
): ModelsUrlRegistry {
  const registry = new Map<string, ModelsUrlEntry>()
  for (const entry of entries) {
    const path = withoutTrailingSlash(entry.path)
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
    if (!target || target.kind === 'alias')
      throw new Error(
        `${entry.path} redirects to ${entry.destination}, which is not a registered page`
      )
  }
  return registry
}

const displayEntries = workshopDisplayEntriesSchema.parse(displayJson)
const displaySlugs = (types: readonly WorkshopDisplayEntry['type'][]) =>
  displayEntries
    .filter((entry) => types.includes(entry.type))
    .map(({ slug }) => slug)

const modelsUrlRegistry = buildModelsUrlRegistry(
  modelsUrlEntries({
    models: hubModelSlugs,
    workflows: displaySlugs(['CLOUD', 'SERVERLESS']),
    apps: displaySlugs(['APP']),
    aliases: hubModelAliases
  })
)

export function modelsUrlKind(
  pathname: string,
  registry: ModelsUrlRegistry = modelsUrlRegistry
): ModelsUrlKind | undefined {
  return registry.get(withoutTrailingSlash(pathname))?.kind
}

const isUnderModels = (pathname: string) =>
  [MODELS_BASE_PATH, HUB_MODELS_PATH].some(
    (base) => pathname === base || pathname.startsWith(`${base}/`)
  )

/** Built pages under a Models base that no registry entry claims. */
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
        isUnderModels(pathname) &&
        modelsUrlKind(pathname, registry) === undefined
    )
}
