import type { CatalogueEntry, EntryKind } from './catalogue-entries'
import {
  cheapestOperation,
  hubWorkflowPath,
  modelGroupKey,
  modelGroupPath
} from './catalogue-entries'
import { getLogoPath } from './model-logos'

interface CardMedia {
  readonly url: string
  readonly kind: 'image' | 'video' | 'audio'
}

/**
 * The line that says a model and a workflow are a capability and a use of it
 * rather than two products with one name. It is the only element on the card
 * that names something other than the card itself.
 */
type CardCrossing =
  | { readonly to: 'workflows'; readonly count: number; readonly href: string }
  | { readonly to: 'model'; readonly name: string; readonly href: string }

export interface CardView {
  readonly kind: EntryKind
  readonly href: string
  readonly title: string
  readonly media: CardMedia | undefined
  readonly hoverMedia: string | undefined
  readonly maker: { readonly label: string; readonly logo: string | undefined }
  /** Run here against credits, or open a file in ComfyUI. */
  readonly action: 'run' | 'open'
  /** What a run costs, as the Router prices it. Workflows have no price. */
  readonly price: string | undefined
  readonly crossing: CardCrossing | undefined
  readonly needsCustomNodes: boolean
  readonly tags: readonly string[]
}

const catalogueModelHref = (name: string) =>
  `?model=${encodeURIComponent(name)}`

function modelCard(
  entry: Extract<CatalogueEntry, { kind: 'model' }>,
  prices: ReadonlyMap<string, string>
): CardView {
  const { model, workflows } = entry
  const provider = model.provider ?? ''
  return {
    kind: 'model',
    // One card per name, so it opens the name rather than one of the rows the
    // registry happens to list under it.
    href: modelGroupPath(entry.key),
    title: model.name,
    media: model.thumbnail,
    hoverMedia: undefined,
    maker: {
      label: provider,
      logo: getLogoPath(provider) ?? getLogoPath(model.name) ?? undefined
    },
    action: 'run',
    price: prices.get(cheapestOperation(entry).slug),
    // A count of nothing is not worth a line, and 104 of the 122 names have
    // none: the crossing is an enhancement, never part of the card's frame.
    crossing:
      workflows.length > 0
        ? {
            to: 'workflows',
            count: workflows.length,
            href: catalogueModelHref(model.name)
          }
        : undefined,
    needsCustomNodes: false,
    tags: model.capabilities
  }
}

function workflowCard(
  entry: Extract<CatalogueEntry, { kind: 'workflow' | 'app' }>,
  needsCustomNodes: ReadonlySet<string>
): CardView {
  const { template, runsOn } = entry
  return {
    kind: entry.kind,
    // The card opens the workflow, never the model behind it. Sending a
    // workflow card to a model page is what makes the two read as one thing.
    href: hubWorkflowPath(template.name),
    title: template.title,
    media: template.thumbnails[0]
      ? { url: template.thumbnails[0], kind: 'image' }
      : undefined,
    hoverMedia: template.thumbnails[1],
    maker: { label: template.username || 'ComfyUI', logo: undefined },
    action: 'open',
    price: undefined,
    // The crossing stays inside the catalogue: the model's own page carries
    // every operation under that name, where its live URL carries one.
    crossing: runsOn
      ? {
          to: 'model',
          name: runsOn.name,
          href: modelGroupPath(modelGroupKey(runsOn.name))
        }
      : undefined,
    needsCustomNodes: needsCustomNodes.has(template.name),
    tags: template.tags
  }
}

export function cardViewFor(
  entry: CatalogueEntry,
  needsCustomNodes: ReadonlySet<string>,
  prices: ReadonlyMap<string, string>
): CardView {
  return entry.kind === 'model'
    ? modelCard(entry, prices)
    : workflowCard(entry, needsCustomNodes)
}
