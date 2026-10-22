import type { WorkshopModelDetail } from '@/config/models-catalogue'
import type { RouterRenderParameters } from '@/config/router-parameters'
import {
  mapRouterParameters,
  routerParameterMappings
} from '@/config/router-parameters'
import { workshopPageSchema } from '@/config/workshop-page-state'
import { defaultValues } from '@/config/workshop-playground'

/**
 * The form a studio request sends: the model's own defaults with the shot on
 * top. A model page starts from its catalogue example instead, and that must
 * never reach the studio: FLUX 2 Max's example would attach a sofa photo to
 * every take, GPT Image's would raise quality to high, Krea's would lower
 * creativity.
 */
export function studioRouterForm(
  model: WorkshopModelDetail,
  parameters: RouterRenderParameters
) {
  const schema = workshopPageSchema(model)
  return {
    schema,
    values: mapRouterParameters(
      schema,
      defaultValues(schema),
      parameters,
      routerParameterMappings(model.execution, model.modality)
    )
  }
}
