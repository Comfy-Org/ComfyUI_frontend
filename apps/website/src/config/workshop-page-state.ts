import type { WorkshopModelDetail } from './models-catalogue'
import { applyRouterDefaultInputs } from './router-default-inputs'
import type {
  FallbackFieldLabels,
  FieldSchema,
  FormValues,
  PlaygroundExample
} from '@comfyorg/router-playground/workshop-playground'
import {
  defaultValues,
  exampleValues,
  examplesForModel,
  schemaForModel
} from '@comfyorg/router-playground/workshop-playground'
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

/** The fallback form's labels, in the page's language. */
function fallbackFieldLabels(locale: Locale): FallbackFieldLabels {
  return {
    prompt: t('workshop.field.prompt', locale),
    promptPlaceholder: t('workshop.field.promptPlaceholder', locale),
    seed: t('workshop.field.seed', locale),
    image: t('workshop.field.image', locale),
    aspectRatio: t('workshop.field.aspectRatio', locale),
    duration: t('workshop.field.duration', locale)
  }
}

export function workshopPageSchema(
  model: WorkshopModelDetail,
  activeExample?: PlaygroundExample,
  locale: Locale = 'en'
): readonly FieldSchema[] {
  return schemaForModel(
    {
      fields: activeExample?.fields ?? model.fields,
      modality: model.modality,
      incompleteReason: model.incompleteReason,
      form: activeExample?.fields ? undefined : model.form
    },
    fallbackFieldLabels(locale)
  )
}

export interface InitialWorkshopPageState {
  readonly examples: readonly PlaygroundExample[]
  readonly firstExample?: PlaygroundExample
  readonly activeExample?: PlaygroundExample
  readonly schema: readonly FieldSchema[]
  readonly values: FormValues
}

export function workshopExampleState(
  model: WorkshopModelDetail,
  example: PlaygroundExample,
  locale: Locale = 'en'
) {
  const schema = workshopPageSchema(model, example, locale)
  const exampleState = exampleValues(schema, example)
  const seeded = applyRouterDefaultInputs(model, schema, exampleState)
  // The example owns every field it sets, including the indexed siblings of
  // those fields (reference_image_url_2, …): an authored page default must not
  // top up a media list the example already provides with template files.
  const provided = new Set(Object.keys(example.values).map(baseFieldName))
  return {
    schema,
    values: {
      ...seeded,
      ...Object.fromEntries(
        schema
          .filter((field) => provided.has(baseFieldName(field.name)))
          .map((field) => [field.name, exampleState[field.name]])
      )
    }
  }
}

function baseFieldName(name: string): string {
  return name.replace(/_\d+$/, '')
}

/** The exact form state a model page presents before the visitor changes it. */
export function initialWorkshopPageState(
  model: WorkshopModelDetail,
  locale: Locale = 'en'
): InitialWorkshopPageState {
  const examples = examplesForModel(model)
  const firstExample = examples.at(0)
  const activeExample =
    firstExample?.fields && !firstExample.sampleOnly ? firstExample : undefined
  const schema = workshopPageSchema(model, activeExample, locale)
  const state =
    firstExample && !firstExample.sampleOnly
      ? workshopExampleState(model, firstExample, locale)
      : {
          schema,
          values: applyRouterDefaultInputs(
            model,
            schema,
            defaultValues(schema, model.defaults)
          )
        }
  return {
    examples,
    firstExample,
    activeExample,
    ...state
  }
}
