import type { CatalogueEntry, EntryKind } from './catalogue-entries'
import { hubWorkflowPath, modelGroupPath } from './catalogue-entries'
import { getLogoPath } from './model-logos'

interface CardMedia {
  readonly url: string
  readonly kind: 'image' | 'video' | 'audio'
}

/**
 * What the grid draws. A card says what a thing is and opens it; the verb, the
 * models a workflow calls and the workflows built on a model belong to the page
 * behind it, because that is where the reader can act on them.
 */
export interface CardView {
  readonly kind: EntryKind
  readonly href: string
  readonly title: string
  readonly media: CardMedia | undefined
  readonly hoverMedia: string | undefined
  readonly maker: { readonly label: string; readonly logo: string | undefined }
  readonly needsCustomNodes: boolean
}

function modelCard(
  entry: Extract<CatalogueEntry, { kind: 'model' }>
): CardView {
  const { model } = entry
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
    needsCustomNodes: false
  }
}

function workflowCard(
  entry: Extract<CatalogueEntry, { kind: 'workflow' }>,
  needsCustomNodes: ReadonlySet<string>
): CardView {
  const { template } = entry
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
    needsCustomNodes: needsCustomNodes.has(template.name)
  }
}

export function cardViewFor(
  entry: CatalogueEntry,
  needsCustomNodes: ReadonlySet<string>
): CardView {
  return entry.kind === 'model'
    ? modelCard(entry)
    : workflowCard(entry, needsCustomNodes)
}
