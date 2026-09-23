import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { taskLabelFor } from '../workshop/task-label'
import type { CatalogueEntry, EntryKind } from './catalogue-entries'
import { hubWorkflowPath, modelGroupPath } from './catalogue-entries'
import { displayModelName } from './model-identity'
import { getLogoPath } from './model-logos'
import { usefulTags } from './tag-aliases'
import type { WorkflowReach } from './workflow-reach'
import { workflowReach } from './workflow-reach'
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
  /**
   * Whether the two stills are the same frame before and after the workflow
   * ran. They are split under the pointer rather than crossfaded, because what
   * changed is the point and a fade shows it only in passing.
   */
  readonly compare: boolean
  readonly maker: { readonly label: string; readonly logo: string | undefined }
  /**
   * Who answers for the thing: the provider of a model, the model a workflow
   * runs on. It rides over the artwork, because it is what tells one card from
   * the next once the title has named the job.
   */
  readonly mark: { readonly label: string; readonly logo: string | undefined }
  /** What it can do, in the words the catalogue filters by. */
  readonly badges: readonly string[]
  /**
   * How far a workflow can be taken as it stands. The shared Cloud endpoint is
   * the ordinary case and says nothing; the other two are what change what a
   * reader or a developer can do next, so only they are marked.
   */
  readonly reach: WorkflowReach | undefined
}

/** A model is known by its maker's mark, wherever the model is named. */
const markFor = (model: WorkshopModel) =>
  getLogoPath(model.provider ?? '') ?? getLogoPath(model.name) ?? undefined

function modelCard(
  entry: Extract<CatalogueEntry, { kind: 'model' }>,
  locale: Locale
): CardView {
  const { model } = entry
  const provider = model.provider ?? ''
  const logo = markFor(model)
  return {
    kind: 'model',
    // One card per name, so it opens the name rather than one of the rows the
    // registry happens to list under it.
    href: modelGroupPath(entry.key),
    // One card per model, so it goes by the model's name: the operation is a
    // choice inside the page, not part of what the model is called.
    title: displayModelName(model, entry.operations),
    media: model.thumbnail,
    hoverMedia: undefined,
    compare: false,
    maker: { label: provider, logo },
    mark: { label: provider, logo },
    badges: [taskLabelFor(model, locale), ...model.capabilities],
    reach: undefined
  }
}

function workflowCard(
  entry: Extract<CatalogueEntry, { kind: 'workflow' }>,
  models: readonly WorkshopModel[]
): CardView {
  const { template, runsOn } = entry
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
    compare: template.thumbnailVariant === 'compareSlider',
    maker: { label: template.username || 'ComfyUI', logo: undefined },
    // The registry names a row for its operation, so `Seedream 5.0 Lite
    // Text-to-Image` is the model plus a verb the card has already said. Most
    // of the launch list runs on models this catalogue does not carry, so the
    // graph's own word for what it calls stands when nothing else does — and
    // the maker's mark is looked up from that word too, because a name the
    // catalogue lacks is still a name the logos know.
    mark: {
      label: runsOn
        ? displayModelName(runsOn, [...models, runsOn])
        : (template.models[0] ?? ''),
      logo: runsOn
        ? markFor(runsOn)
        : (getLogoPath(template.models[0] ?? '') ?? undefined)
    },
    badges: usefulTags(template.tags),
    reach: workflowReach(template.name, false)
  }
}

export function cardViewFor(
  entry: CatalogueEntry,
  models: readonly WorkshopModel[] = [],
  locale: Locale = 'en'
): CardView {
  return entry.kind === 'model'
    ? modelCard(entry, locale)
    : workflowCard(entry, models)
}
