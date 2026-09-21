import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import { workshopModels } from '../../config/workshop-browse-content'
import hubTemplateDetails from '../../data/hubTemplateDetails.json'
import hubTemplates from '../../data/hubTemplates.json'
import { modelIdentity, modelName } from './model-identity'
import { partnerModelFor, useCaseForTemplate } from './template-use-case'
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
  /** The job it does, which names it where the registry named it after a model. */
  readonly useCase: UseCase | undefined
  readonly callsPartnerModel: boolean
  readonly customNodes: readonly string[]
  /** Bytes of weights to download before it runs. Zero for partner workflows. */
  readonly weightsBytes: number
  readonly inputs: readonly HubIoRow[]
  readonly outputs: readonly HubIoRow[]
  readonly related: readonly HubTemplate[]
  readonly downloadUrl: string
}

const templates = hubTemplatesSchema.parse(hubTemplates)
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
  return [...new Set(template.models)].map((name) => ({
    name,
    model: models.find((model) => normalize(model.name) === normalize(name))
  }))
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
    useCase: useCaseForTemplate(template, workshopModels),
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
 * A registry title is written as "<model>: <operation>", which says which
 * model runs before it says what the workflow gets you, and sometimes says
 * only the model. Where the title leads with a model the workflow names, the
 * page puts the job first and keeps the model after it.
 *
 * A title that already leads with its job — "Video Upscale: SeedVR2 3B Int8"
 * — is left alone, which is the shape everything here is moving towards.
 */
export function workflowJobTitle(
  page: HubWorkflowPage
): { readonly useCase: UseCase; readonly model: string } | undefined {
  const { useCase, template } = page
  if (!useCase) return undefined
  const lead = template.title.split(':')[0].trim()
  if (!lead) return undefined
  const namesTheModel = template.models.some(
    (model) => plainName(model) === plainName(lead)
  )
  return namesTheModel ? { useCase, model: lead } : undefined
}

const plainName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')
