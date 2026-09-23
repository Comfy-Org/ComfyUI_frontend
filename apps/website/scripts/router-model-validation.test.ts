import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  resolveModelRouterRender,
  router_render
} from '../src/config/router-render'
import { readWorkshopVideoDuration } from '../src/config/workshop-media-metadata'
import { validateWorkshopMediaInputs } from '../src/config/workshop-media-validation'
import {
  initialWorkshopPageState,
  workshopExampleState
} from '../src/config/workshop-page-state'
import { getAuthoredRouterWorkshopModelDetail } from '../src/config/workshop-router-content'
import type { WorkshopUrlEncoder } from '../src/config/workshop-url-input'
import { selectRouterModels } from './router-model-selection'
import { invalidRouterModelInputs } from './router-model-validation-cases'

vi.mock(import('../src/config/workshop-media-metadata'))

const models = selectRouterModels({}).map(({ slug }) => {
  const model = getAuthoredRouterWorkshopModelDetail(slug)
  assert.exists(model)
  return { model, slug, ...initialWorkshopPageState(model) }
})
const network = vi.fn<typeof fetch>()
const credential = vi.fn(async () => 'unused-validation-credential')
const upload = vi.fn<WorkshopUrlEncoder>()

beforeEach(() => {
  network.mockRejectedValue(new Error('Validation must not access the network'))
  upload.mockRejectedValue(new Error('Validation must not upload inputs'))
  vi.stubGlobal('fetch', network)
})

describe('published model validation grid', () => {
  for (const { model, slug, schema, values, examples } of models) {
    describe(slug, () => {
      it('accepts its initial RUN inputs', () => {
        expect(() => resolveModelRouterRender(model)).not.toThrow()
        expect(network).not.toHaveBeenCalled()
      })

      it.for(
        examples
          .filter((example) => !example.sampleOnly)
          .map((example) => ({
            title: example.title,
            ...workshopExampleState(model, example)
          }))
      )('accepts runnable example $title', ({ schema, values }) => {
        expect(
          resolveModelRouterRender(model, {}, { form: { schema, values } })
            .values
        ).toEqual(values)
        expect(network).not.toHaveBeenCalled()
      })

      it.for(invalidRouterModelInputs(schema))(
        'rejects $field / $rule before upload or generation',
        async ({ field, value, error }) => {
          await expect(
            router_render(
              model.slug,
              {},
              {
                model,
                form: { schema, values: { ...values, [field]: value } },
                token: credential,
                uploadFile: upload
              }
            )
          ).rejects.toMatchObject({
            reason: 'validation',
            fieldErrors: { [field]: error }
          })
          expect(network).not.toHaveBeenCalled()
          expect(upload).not.toHaveBeenCalled()
          expect(credential).not.toHaveBeenCalled()
        }
      )

      it('has invalid-input coverage', () => {
        expect(invalidRouterModelInputs(schema).length).toBeGreaterThan(0)
      })

      const videoLimits = schema.flatMap((field) =>
        field.presentation?.maxVideoDurationSeconds === undefined
          ? []
          : [
              {
                field: field.name,
                maximum: field.presentation.maxVideoDurationSeconds
              }
            ]
      )
      it.for(videoLimits)(
        'accepts $field at its duration limit',
        async ({ maximum }) => {
          vi.mocked(readWorkshopVideoDuration).mockResolvedValue(maximum)
          await expect(
            validateWorkshopMediaInputs(
              schema,
              values,
              new AbortController().signal
            )
          ).resolves.toBeUndefined()
          expect(readWorkshopVideoDuration).toHaveBeenCalled()
          expect(network).not.toHaveBeenCalled()
        }
      )

      it.for(videoLimits)(
        'rejects $field above its duration limit',
        async ({ field, maximum }) => {
          vi.mocked(readWorkshopVideoDuration).mockResolvedValue(maximum + 0.01)
          await expect(
            validateWorkshopMediaInputs(
              schema,
              values,
              new AbortController().signal
            )
          ).rejects.toMatchObject({
            reason: 'validation',
            fieldErrors: { [field]: 'videoTooLong' }
          })
          expect(network).not.toHaveBeenCalled()
        }
      )
    })
  }
})
