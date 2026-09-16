/**
 * How far the models catalogue and the workflow catalogue overlap.
 *
 * The V2 question is whether models and workflows browse as one list or as
 * two, and the answer turns on numbers that move every time the template
 * snapshot or the router catalogue is refreshed. Measure them rather than
 * quote them: pnpm hub:audit-overlap
 *
 * Recorded in ADR-WEBSITE-CATALOGUE-0032.
 */
import type { WorkshopModel } from '../src/config/models-catalogue'
import { workshopModels } from '../src/config/workshop-browse-content'
import hubTemplateDetails from '../src/data/hubTemplateDetails.json'
import hubTemplates from '../src/data/hubTemplates.json'
import {
  partnerModelFor,
  useCaseForTemplate
} from '../src/lib/hub/template-use-case'
import type { HubTemplate, HubTemplateDetails } from '../src/lib/hub/types'
import {
  hubTemplateDetailsSchema,
  hubTemplatesSchema
} from '../src/lib/hub/types'
import { isDirectExecution } from './script-entry-point'

export interface CountedName {
  readonly name: string
  readonly count: number
}

export interface CatalogueOverlap {
  readonly templates: number
  readonly apps: number
  readonly models: number
  /** Templates that resolve to a model this site can run. */
  readonly runnable: number
  readonly runnableApps: number
  /**
   * Templates that name a catalogue model anywhere in `models[]`, whether or
   * not navigation can route them to it. The wider count, and the one that
   * says how often a merged list would repeat itself.
   */
  readonly mentioning: number
  readonly mentionedModels: number
  readonly mostMentioned: readonly CountedName[]
  readonly needCustomNodes: number
  /** Models named by at least one runnable template. */
  readonly citedModels: number
  readonly mostCited: readonly CountedName[]
  /** Workflow titles that are also a model name, letter for letter. */
  readonly titleCollisions: readonly string[]
  /** Workflow titles that match a model name except for their case. */
  readonly nearMissTitles: readonly string[]
  /** Runnable templates whose title opens with their own model's name. */
  readonly echoes: number
  readonly useCases: readonly CountedName[]
  readonly unclassified: readonly string[]
}

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

const byCount = (a: CountedName, b: CountedName) => b.count - a.count

function counted(tally: Map<string, number>): readonly CountedName[] {
  return [...tally].map(([name, count]) => ({ name, count })).sort(byCount)
}

interface RunnableTally {
  readonly runnable: number
  readonly runnableApps: number
  readonly echoes: number
  readonly cited: Map<string, number>
}

function tallyRunnable(
  templates: readonly HubTemplate[],
  models: readonly WorkshopModel[]
): RunnableTally {
  const cited = new Map<string, number>()
  let runnable = 0
  let runnableApps = 0
  let echoes = 0
  for (const template of templates) {
    const partner = partnerModelFor(template, models)
    if (!partner) continue
    runnable++
    if (template.isApp) runnableApps++
    cited.set(partner.name, (cited.get(partner.name) ?? 0) + 1)
    if (normalize(template.title).startsWith(normalize(partner.name))) echoes++
  }
  return { runnable, runnableApps, echoes, cited }
}

function tallyMentions(
  templates: readonly HubTemplate[],
  models: readonly WorkshopModel[]
) {
  const catalogued = new Map(
    models.map((model) => [normalize(model.name), model.name])
  )
  const mentioned = new Map<string, number>()
  let mentioning = 0
  for (const template of templates) {
    const named = new Set(
      template.models.map(normalize).filter((name) => catalogued.has(name))
    )
    if (named.size === 0) continue
    mentioning++
    for (const name of named) {
      const model = catalogued.get(name) ?? name
      mentioned.set(model, (mentioned.get(model) ?? 0) + 1)
    }
  }
  return {
    mentioning,
    mentionedModels: mentioned.size,
    mostMentioned: counted(mentioned).slice(0, 5)
  }
}

function tallyUseCases(
  templates: readonly HubTemplate[],
  models: readonly WorkshopModel[]
) {
  const useCases = new Map<string, number>()
  const unclassified: string[] = []
  for (const template of templates) {
    const useCase = useCaseForTemplate(template, models)
    if (useCase) useCases.set(useCase, (useCases.get(useCase) ?? 0) + 1)
    else unclassified.push(template.name)
  }
  return { useCases: counted(useCases), unclassified }
}

function titlesAgainstModelNames(
  templates: readonly HubTemplate[],
  models: readonly WorkshopModel[]
) {
  const exact = new Set(models.map((model) => model.name))
  const cased = new Set(models.map((model) => model.name.toLowerCase()))
  const titles = templates.map((template) => template.title)
  return {
    titleCollisions: titles.filter((title) => exact.has(title)),
    nearMissTitles: titles.filter(
      (title) => !exact.has(title) && cased.has(title.toLowerCase())
    )
  }
}

function countingCustomNodes(
  templates: readonly HubTemplate[],
  details: HubTemplateDetails
): number {
  return templates.filter(
    (template) => (details[template.name]?.requiresCustomNodes ?? []).length > 0
  ).length
}

export function auditCatalogueOverlap(
  templates: readonly HubTemplate[],
  models: readonly WorkshopModel[],
  details: HubTemplateDetails
): CatalogueOverlap {
  const { runnable, runnableApps, echoes, cited } = tallyRunnable(
    templates,
    models
  )
  return {
    templates: templates.length,
    apps: templates.filter((template) => template.isApp).length,
    models: models.length,
    runnable,
    runnableApps,
    ...tallyMentions(templates, models),
    needCustomNodes: countingCustomNodes(templates, details),
    citedModels: cited.size,
    mostCited: counted(cited).slice(0, 5),
    ...titlesAgainstModelNames(templates, models),
    echoes,
    ...tallyUseCases(templates, models)
  }
}

function report(overlap: CatalogueOverlap): string {
  const share = (part: number) =>
    `${((part / overlap.templates) * 100).toFixed(1)}%`
  const list = (entries: readonly CountedName[]) =>
    entries.map((entry) => `${entry.name} ${entry.count}`).join(', ')
  return [
    `templates ${overlap.templates}, of them apps ${overlap.apps}`,
    `models ${overlap.models}`,
    `runnable here ${overlap.runnable} (${share(overlap.runnable)})`,
    `runnable apps ${overlap.runnableApps} of ${overlap.apps}`,
    `naming a catalogue model ${overlap.mentioning} across ${overlap.mentionedModels} models: ${list(overlap.mostMentioned)}`,
    `need custom nodes ${overlap.needCustomNodes}`,
    `models cited ${overlap.citedModels}: ${list(overlap.mostCited)}`,
    `titles that are a model name: ${overlap.titleCollisions.join(', ')}`,
    `titles that differ from one only by case: ${overlap.nearMissTitles.join(', ')}`,
    `runnable titles echoing their model ${overlap.echoes}`,
    `use cases ${list(overlap.useCases)}`,
    `unclassified ${overlap.unclassified.length}`
  ].join('\n')
}

if (isDirectExecution(process.argv[1], import.meta.filename))
  console.warn(
    report(
      auditCatalogueOverlap(
        hubTemplatesSchema.parse(hubTemplates),
        workshopModels,
        hubTemplateDetailsSchema.parse(hubTemplateDetails)
      )
    )
  )
