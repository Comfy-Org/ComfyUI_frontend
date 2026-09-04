import type {
  WorkshopDetailModel,
  WorkshopFormValues,
  WorkshopRunTargetId
} from './workshop-detail'
import type { WorkshopRunOptions, WorkshopRunResult } from './workshop-run'
import { runRouterModel } from './workshop-run'
import type { WorkshopSnippetLanguage } from './workshop-snippets'
import {
  ROUTER_SNIPPET_LANGUAGES,
  buildRouterSnippet,
  buildWorkshopInput
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
  /**
   * Runs the model with the values currently in the form.
   *
   * Takes the same `values` the snippet does, so what the page runs and what
   * it tells you to copy cannot drift apart — they are built from one input.
   */
  run(
    model: WorkshopDetailModel,
    values: WorkshopFormValues,
    options: WorkshopRunOptions
  ): Promise<WorkshopRunResult>
}

/**
 * LOCAL ONLY. Off unless `PUBLIC_WORKSHOP_PARTNER_PROXY=1` is set, which only
 * a gitignored .env does — so tests and any build exercise the committed
 * Router path, and only the local dev server routes through the bundle.
 */
const USE_PARTNER_PROXY = import.meta.env.PUBLIC_WORKSHOP_PARTNER_PROXY === '1'

const routerRunTarget: WorkshopRunTarget = {
  id: 'router',
  snippetLanguages: ROUTER_SNIPPET_LANGUAGES,
  buildSnippet: (language, model, values) =>
    buildRouterSnippet(language, model.id, model.fields, values),
  run: async (model, values, options) => {
    // LOCAL ONLY. The catalog's parameters describe a normalized authoring
    // shape that only the partner bundle can turn into a partner-native
    // request, so posting our form values straight at Router runs the wrong
    // body: measured, it drops reference images on the BFL models and
    // silently ignores the prompt on ideogram/v4. Flip this off to get the
    // committed Router behaviour back.
    if (USE_PARTNER_PROXY) {
      const { runViaPartnerProxy } = await import('./workshop-run-proxy')
      return runViaPartnerProxy(model, values, options.credentials)
    }
    return runRouterModel(
      model.id,
      buildWorkshopInput(model.fields, values),
      options
    )
  }
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
