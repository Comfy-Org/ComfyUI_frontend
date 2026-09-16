import type { WorkshopModel } from '../../config/models-catalogue'
import { workshopModels } from '../../config/workshop-browse-content'
import hubTemplateDetails from '../../data/hubTemplateDetails.json'
import hubTemplates from '../../data/hubTemplates.json'
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

export interface HubWorkflowPage {
  readonly template: HubTemplate
  readonly mediaType: string
  readonly details: HubTemplateDetail
  readonly runsOn: readonly HubWorkflowModelRef[]
  /** The one model page this workflow can open without guessing. */
  readonly destination: WorkshopModel | undefined
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

// Workflows sharing ground with this one: a tag or a model in common. Apps are
// a different promise, so a node graph never recommends one.
function relatedTo(template: HubTemplate): readonly HubTemplate[] {
  return templates
    .filter(
      (other) =>
        other.name !== template.name &&
        other.isApp === template.isApp &&
        (other.tags.some((tag) => template.tags.includes(tag)) ||
          other.models.some((model) => template.models.includes(model)))
    )
    .sort((a, b) => b.usage - a.usage)
    .slice(0, 8)
}

/** Weights to download before it runs, rounded to what a reader decides on. */
export function formatWeights(bytes: number): string | undefined {
  if (bytes <= 0) return undefined
  const gigabytes = bytes / 1_000_000_000
  return gigabytes >= 1
    ? `${Math.round(gigabytes)} GB`
    : `${Math.round(bytes / 1_000_000)} MB`
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
    destination: partnerModelFor(template, workshopModels),
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
