import type {
  WorkshopDetailModel,
  WorkshopFormValues,
  WorkshopRunTargetId
} from './workshop-detail'
import type { WorkshopSnippetLanguage } from './workshop-snippets'
import {
  ROUTER_SNIPPET_LANGUAGES,
  buildRouterSnippet
} from './workshop-snippets'

/**
 * How a model gets run, and therefore what its page tells you to call.
 *
 * Everything on Workshop is a Router partner model today. Cloud workflows
 * and deployed endpoints are next, and they do not share Router's URL, its
 * SDK call, or even its set of usable snippet languages — a workflow has no
 * `comfy.models.run` equivalent. Resolving those through one interface keeps
 * that knowledge out of the page and the form, which only ever deal in
 * fields and values.
 */
export interface WorkshopRunTarget {
  readonly id: WorkshopRunTargetId
  /** Not every target can offer every language, so the target decides. */
  readonly snippetLanguages: readonly WorkshopSnippetLanguage[]
  buildSnippet(
    language: WorkshopSnippetLanguage,
    model: WorkshopDetailModel,
    values: WorkshopFormValues
  ): string
}

const routerRunTarget: WorkshopRunTarget = {
  id: 'router',
  snippetLanguages: ROUTER_SNIPPET_LANGUAGES,
  buildSnippet: (language, model, values) =>
    buildRouterSnippet(language, model.id, model.fields, values)
}

const RUN_TARGETS: Readonly<Record<WorkshopRunTargetId, WorkshopRunTarget>> = {
  router: routerRunTarget
}

/**
 * The target a model runs on. A snapshot entry without an explicit
 * `runTarget` is a Router model, which is every entry we generate today.
 */
export function runTargetFor(
  model: Pick<WorkshopDetailModel, 'runTarget'>
): WorkshopRunTarget {
  return RUN_TARGETS[model.runTarget ?? 'router']
}
