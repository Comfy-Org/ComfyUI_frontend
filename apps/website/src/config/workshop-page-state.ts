import type { WorkshopModelDetail } from './models-catalogue'
import { applyRouterDefaultInputs } from './router-default-inputs'
import type {
  FieldSchema,
  FormValues,
  PlaygroundExample
} from './workshop-playground'
import {
  defaultValues,
  exampleValues,
  examplesForModel,
  schemaForModel
} from './workshop-playground'

export function workshopPageSchema(
  model: WorkshopModelDetail,
  activeExample?: PlaygroundExample
): readonly FieldSchema[] {
  return schemaForModel({
    fields: activeExample?.fields ?? model.fields,
    modality: model.modality,
    incompleteReason: model.incompleteReason,
    form: activeExample?.fields ? undefined : model.form
  })
}

export interface InitialWorkshopPageState {
  readonly examples: readonly PlaygroundExample[]
  readonly firstExample?: PlaygroundExample
  readonly activeExample?: PlaygroundExample
  readonly schema: readonly FieldSchema[]
  readonly values: FormValues
}

/** The exact form state a model page presents before the visitor changes it. */
export function initialWorkshopPageState(
  model: WorkshopModelDetail
): InitialWorkshopPageState {
  const examples = examplesForModel(model)
  const firstExample = examples.at(0)
  const activeExample =
    firstExample?.fields && !firstExample.sampleOnly ? firstExample : undefined
  const schema = workshopPageSchema(model, activeExample)
  const values =
    firstExample && !firstExample.sampleOnly
      ? exampleValues(schema, firstExample)
      : defaultValues(schema, model.defaults)
  return {
    examples,
    firstExample,
    activeExample,
    schema,
    values: applyRouterDefaultInputs(model, schema, values)
  }
}
