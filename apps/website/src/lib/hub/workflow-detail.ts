import type { WorkshopModel } from '../../config/models-catalogue'
import { workshopModels } from '../../config/workshop-browse-content'
import hubTemplateDetails from '../../data/hubTemplateDetails.json'
import hubTemplates from '../../data/hubTemplates.json'
import { modelIdentity, modelName } from './model-identity'
import { launchesHere } from '../../config/workshop-launch'
import { runsHere } from './runs-here'
import type { WorkflowReach } from './workflow-reach'
import { workflowReach } from './workflow-reach'
import { partnerModelFor } from './template-use-case'
import type { HubTemplate, HubTemplateDetails } from './types'
import { hubTemplateDetailsSchema, hubTemplatesSchema } from './types'

type HubTemplateDetail = HubTemplateDetails[string]

/** A model the workflow names, linked only where the catalogue carries it. */
interface HubWorkflowModelRef {
  readonly name: string
  readonly model: WorkshopModel | undefined
}

interface HubIoRow {
  readonly name: string
  readonly type: string
}

/**
 * The model page a workflow opens, named after the model rather than the one
 * operation the join happened to land on.
 */
interface HubWorkflowDestination {
  readonly key: string
  readonly slug: string
  readonly name: string
}

export interface HubWorkflowPage {
  readonly template: HubTemplate
  readonly mediaType: string
  readonly details: HubTemplateDetail
  readonly runsOn: readonly HubWorkflowModelRef[]
  /** The one model page this workflow can open without guessing. */
  readonly destination: HubWorkflowDestination | undefined
  /**
   * Whether the page can run it inline, as a form and a Run button. Naming a
   * model is not enough: the graph around it has to be one the Router can
   * serve, with nothing to load and nothing to install. Everything else runs
   * on Cloud and the page offers the way there instead.
   */
  readonly runsInline: boolean
  readonly callsPartnerModel: boolean
  readonly customNodes: readonly string[]
  /** Bytes of weights to download before it runs. Zero for partner workflows. */
  readonly weightsBytes: number
  readonly inputs: readonly HubIoRow[]
  readonly outputs: readonly HubIoRow[]
  readonly related: readonly HubTemplate[]
  readonly downloadUrl: string
}

const templates = hubTemplatesSchema
  .parse(hubTemplates)
  .filter((template) => launchesHere(template.name))
const details: HubTemplateDetails =
  hubTemplateDetailsSchema.parse(hubTemplateDetails)

export function listHubWorkflows(): readonly HubTemplate[] {
  return templates
}

// The index's mediaType describes the thumbnail; what the workflow produces is
// its first declared output.
function outputMediaType(
  template: HubTemplate,
  detail: HubTemplateDetail
): string {
  return detail.outputs?.[0]?.mediaType ?? template.mediaType
}

// A graph can load three images through three LoadImage nodes, and three rows
// reading "LoadImage" say nothing about which is which.
function portRows(
  ports: readonly { nodeType?: string; mediaType?: string }[] | undefined
): HubIoRow[] {
  const seen = new Map<string, number>()
  return (ports ?? []).map((port) => {
    const base = port.nodeType ?? port.mediaType ?? 'node'
    const nth = (seen.get(base) ?? 0) + 1
    seen.set(base, nth)
    return {
      name: nth > 1 ? `${base} ${nth}` : base,
      type: port.mediaType ?? 'file'
    }
  })
}

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

function modelRefs(
  template: HubTemplate,
  models: readonly WorkshopModel[]
): HubWorkflowModelRef[] {
  // Some registry rows name the maker alongside the model, so `Runs on` reads
  // `Google` and then `Nano Banana 2` as though the graph called two of them.
  const makers = new Set(
    models.flatMap((model) =>
      model.provider ? [normalize(model.provider)] : []
    )
  )
  return [...new Set(template.models)]
    .map((name) => ({
      name,
      model: models.find((model) => normalize(model.name) === normalize(name))
    }))
    .filter((ref) => ref.model || !makers.has(normalize(ref.name)))
}

// Workflows sharing ground with this one: a tag or a model in common.
function relatedTo(template: HubTemplate): readonly HubTemplate[] {
  return templates
    .filter(
      (other) =>
        other.name !== template.name &&
        (other.tags.some((tag) => template.tags.includes(tag)) ||
          other.models.some((model) => template.models.includes(model)))
    )
    .sort((a, b) => b.usage - a.usage)
    .slice(0, 8)
}

/** Weights to download before it runs, rounded to what a reader decides on. */
/** What a reader brings or takes away, counted by medium rather than by node. */
export interface HubPortSummary {
  readonly media: string
  readonly count: number
}

export function summarisePorts(
  rows: readonly HubIoRow[]
): readonly HubPortSummary[] {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.type, (counts.get(row.type) ?? 0) + 1)
  return [...counts].map(([media, count]) => ({ media, count }))
}

function destinationFor(
  template: HubTemplate
): HubWorkflowDestination | undefined {
  const model = partnerModelFor(template, workshopModels)
  return model
    ? {
        key: modelIdentity(model.slug),
        slug: model.slug,
        name: modelName(model, workshopModels)
      }
    : undefined
}

export function getHubWorkflowPage(name: string): HubWorkflowPage | undefined {
  const template = templates.find((entry) => entry.name === name)
  if (!template) return undefined
  const detail: HubTemplateDetail = details[name] ?? {}
  return {
    template,
    mediaType: outputMediaType(template, detail),
    details: detail,
    runsOn: modelRefs(template, workshopModels),
    destination: destinationFor(template),
    runsInline: runsHere(template),
    callsPartnerModel: template.tags.includes('API'),
    customNodes: detail.requiresCustomNodes ?? [],
    weightsBytes: detail.size ?? 0,
    inputs: portRows(detail.inputs),
    outputs: portRows(
      detail.outputs?.length
        ? detail.outputs
        : [{ mediaType: outputMediaType(template, detail) }]
    ),
    related: relatedTo(template),
    downloadUrl: `https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/${encodeURIComponent(template.name)}.json`
  }
}

/**
 * One workflow of each kind, so the reference tool can take a reader to a
 * page that genuinely is that kind rather than dress one up as another. What
 * a kind changes — whether a playground exists at all, what the badge says —
 * is decided when the page is built, so only a real page of it is honest.
 */
export function workflowByReach(): Partial<Record<WorkflowReach, string>> {
  const found: Partial<Record<WorkflowReach, string>> = {}
  for (const template of templates)
    found[workflowReach(template.name, runsHere(template))] ??= template.name
  return found
}
