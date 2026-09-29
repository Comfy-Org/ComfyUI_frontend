import { appModels } from './workshop-app-content'
import {
  routerModelSlugAliases,
  workshopModels
} from './workshop-browse-content'
import { workflowModels } from './workshop-workflow-content'

export const MODELS_BASE_PATH = '/models'

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

export function buildModelsUrlRegistry(
  entries: readonly ModelsUrlEntry[]
): ModelsUrlRegistry {
  const registry = new Map<string, ModelsUrlEntry>()
  for (const entry of entries) {
    const claimed = registry.get(entry.path)
    if (claimed)
      throw new Error(
        `${entry.path} is registered twice, as ${claimed.kind} and as ${entry.kind}`
      )
    registry.set(entry.path, entry)
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

export const modelsUrlRegistry = buildModelsUrlRegistry(
  modelsUrlEntries({
    models: workshopModels.map(({ slug }) => slug),
    workflows: workflowModels.map(({ slug }) => slug),
    apps: appModels.map(({ slug }) => slug),
    aliases: routerModelSlugAliases
  })
)

export function modelsUrlKind(
  pathname: string,
  registry: ModelsUrlRegistry = modelsUrlRegistry
): ModelsUrlKind | undefined {
  return registry.get(pathname.replace(/\/$/, ''))?.kind
}

/** Built pages under the Models base that no registry entry claims. */
export function unregisteredModelsPaths(
  pathnames: readonly string[],
  registry: ModelsUrlRegistry = modelsUrlRegistry,
  base = MODELS_BASE_PATH
): string[] {
  return pathnames
    .map((pathname) => `/${pathname}`.replace(/^\/+/, '/').replace(/\/$/, ''))
    .filter(
      (pathname) =>
        pathname.startsWith(`${base}/`) &&
        modelsUrlKind(pathname, registry) === undefined
    )
}
