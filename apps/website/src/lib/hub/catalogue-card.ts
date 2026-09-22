import type { Locale } from '../../i18n/translations'
import { taskLabelFor } from '../workshop/task-label'
import type { CatalogueEntry, EntryKind } from './catalogue-entries'
import { hubWorkflowPath, modelGroupPath } from './catalogue-entries'
import { getLogoPath } from './model-logos'
import { usefulTags } from './tag-aliases'
import { workflowDisplayTitle } from './workflow-title'

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
  /**
   * Who answers for the thing: the provider of a model, the model a workflow
   * runs on. It rides over the artwork, because it is what tells one card from
   * the next once the title has named the job.
   */
  readonly mark: { readonly label: string; readonly logo: string | undefined }
  /** What it can do, in the words the catalogue filters by. */
  readonly badges: readonly string[]
  readonly needsCustomNodes: boolean
}

function modelCard(
  entry: Extract<CatalogueEntry, { kind: 'model' }>,
  locale: Locale
): CardView {
  const { model } = entry
  const provider = model.provider ?? ''
  const logo = getLogoPath(provider) ?? getLogoPath(model.name) ?? undefined
  return {
    kind: 'model',
    // One card per name, so it opens the name rather than one of the rows the
    // registry happens to list under it.
    href: modelGroupPath(entry.key),
    title: model.name,
    media: model.thumbnail,
    hoverMedia: undefined,
    maker: { label: provider, logo },
    mark: { label: provider, logo },
    badges: [taskLabelFor(model, locale), ...model.capabilities],
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
    title: workflowDisplayTitle(template),
    media: template.thumbnails[0]
      ? { url: template.thumbnails[0], kind: 'image' }
      : undefined,
    hoverMedia: template.thumbnails[1],
    maker: { label: template.username || 'ComfyUI', logo: undefined },
    mark: { label: entry.runsOn?.name ?? '', logo: undefined },
    badges: usefulTags(template.tags),
    needsCustomNodes: needsCustomNodes.has(template.name)
  }
}

export function cardViewFor(
  entry: CatalogueEntry,
  needsCustomNodes: ReadonlySet<string>,
  locale: Locale = 'en'
): CardView {
  return entry.kind === 'model'
    ? modelCard(entry, locale)
    : workflowCard(entry, needsCustomNodes)
}
