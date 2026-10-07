import {
  HUB_APPS_PATH,
  HUB_MODELS_PATH,
  HUB_PATH,
  HUB_WORKFLOWS_PATH,
  hubAppHref,
  hubAppSlugs,
  hubModelAliases,
  hubModelSlugs,
  hubWorkflowHref,
  hubWorkflowSlugs
} from './hub-models'
import { LOCAL_MODELS_PATH, localModels } from './local-models'

const MODELS_BASE_PATH = '/models'

type PageKind =
  | 'hub'
  | 'section'
  | 'model'
  | 'workflow'
  | 'app'
  | 'local'
  | 'reserved'

const navigableKinds: ReadonlySet<string> = new Set<PageKind>([
  'hub',
  'section',
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
  /** Old page id under `/models` → its slug under `/hub/models`. */
  readonly models: ReadonlyMap<string, string>
  readonly workflows: readonly string[]
  readonly apps: readonly string[]
  /** Old alias under `/models` → the slug under `/hub/models` it serves. */
  readonly aliases: ReadonlyMap<string, string>
  /** Downloadable model files under `/hub/models/local`. */
  readonly localFiles: readonly string[]
}

const withoutTrailingSlash = (pathname: string) => pathname.replace(/\/$/, '')

export function modelsUrlEntries({
  models,
  workflows,
  apps,
  aliases,
  localFiles
}: ModelsUrlSources): ModelsUrlEntry[] {
  const at = (slug: string) => `${MODELS_BASE_PATH}/${slug}`
  const atHub = (slug: string) => `${HUB_MODELS_PATH}/${slug}`
  const atLocal = (file: string) => `${LOCAL_MODELS_PATH}/${file}`
  const page = (kind: PageKind) => (slug: string) => ({ path: at(slug), kind })
  const redirect = ([slug, hubSlug]: readonly [string, string]) => ({
    path: at(slug),
    kind: 'alias' as const,
    destination: atHub(hubSlug)
  })
  return [
    { path: HUB_PATH, kind: 'section' },
    { path: HUB_MODELS_PATH, kind: 'hub' },
    { path: HUB_WORKFLOWS_PATH, kind: 'section' },
    { path: HUB_APPS_PATH, kind: 'section' },
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
    { path: `${HUB_WORKFLOWS_PATH}/manifest.json`, kind: 'reserved' },
    ...workflows.map((slug) => ({
      path: hubWorkflowHref(slug),
      kind: 'workflow' as const
    })),
    ...workflows.map((slug) => ({
      path: at(slug),
      kind: 'alias' as const,
      destination: hubWorkflowHref(slug)
    })),
    ...apps.map((slug) => ({ path: hubAppHref(slug), kind: 'app' as const })),
    ...apps.map((slug) => ({
      path: at(slug),
      kind: 'alias' as const,
      destination: hubAppHref(slug)
    })),
    ...[...models.keys(), ...workflows].map((slug) =>
      page('reserved')(`${slug}/page.json`)
    ),
    { path: LOCAL_MODELS_PATH, kind: 'local' },
    { path: atLocal('llms.txt'), kind: 'reserved' },
    ...localFiles.map((slug) => ({
      path: atLocal(slug),
      kind: 'local' as const
    })),
    ...localFiles.map((slug) => ({
      path: atLocal(`${slug}.md`),
      kind: 'reserved' as const
    })),
    ...Array.from(models, redirect),
    ...Array.from(aliases, redirect)
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

const modelsUrlRegistry = buildModelsUrlRegistry(
  modelsUrlEntries({
    models: hubModelSlugs,
    workflows: hubWorkflowSlugs,
    apps: hubAppSlugs,
    aliases: hubModelAliases,
    localFiles: localModels.map(({ slug }) => slug)
  }),
  [MODELS_BASE_PATH, HUB_PATH]
)

export const modelsUrlRoots = modelsUrlRegistry.roots

export function modelsUrlKind(
  pathname: string,
  registry: ModelsUrlRegistry = modelsUrlRegistry
): ModelsUrlKind | undefined {
  return registry.entries.get(withoutTrailingSlash(pathname))?.kind
}

export function modelsUrlPaths(
  kind: ModelsUrlKind,
  registry: ModelsUrlRegistry = modelsUrlRegistry
): string[] {
  return [...registry.entries.values()]
    .filter((entry) => entry.kind === kind)
    .map(({ path }) => path)
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
