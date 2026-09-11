import type { RouterRenderParameters } from '../src/config/router-parameters'
import {
  createRouterParameters,
  routerParameterMappings
} from '../src/config/router-parameters'
import type { RouterRenderOptions } from '../src/config/router-render'
import {
  prepareModelRouterRender,
  resolveModelRouterRender,
  router_render as render
} from '../src/config/router-render'
import { initialWorkshopPageState } from '../src/config/workshop-page-state'
import { getRouterWorkshopModelDetail } from '../src/config/workshop-router-content'
import { WorkshopRouterError } from '../src/config/workshop-router-errors'

function modelFor(slug: string) {
  const model = getRouterWorkshopModelDetail(slug)
  if (!model) throw new WorkshopRouterError('unavailable')
  return model
}

export function router_for_model(slug: string) {
  const model = modelFor(slug)
  const initial = initialWorkshopPageState(model)
  return createRouterParameters(
    initial.schema,
    initial.values,
    routerParameterMappings(model.execution, model.modality)
  )
}

export function resolveRouterRender(
  slug: string,
  parameters: RouterRenderParameters = {}
) {
  return resolveModelRouterRender(modelFor(slug), parameters)
}

export function prepareRouterRender(
  slug: string,
  parameters: RouterRenderParameters = {},
  signal: AbortSignal = new AbortController().signal
) {
  return prepareModelRouterRender(modelFor(slug), parameters, {
    token: process.env.COMFY_KEY,
    signal
  })
}

export function router_render(
  slug: string,
  parameters: RouterRenderParameters = {},
  options: RouterRenderOptions = {}
) {
  return render(slug, parameters, {
    ...options,
    model: modelFor(slug),
    token: options.token ?? process.env.COMFY_KEY
  })
}
