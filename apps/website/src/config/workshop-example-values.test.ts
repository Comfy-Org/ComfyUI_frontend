import { z } from 'astro/zod'
import { describe, expect, it } from 'vitest'

import {
  routerContentBySlug,
  routerWorkshopModels
} from './workshop-browse-content'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import {
  defaultValues,
  schemaForModel,
  urlUploadField
} from './workshop-playground'
import { workshopExampleValues } from './workshop-example-values'

const mediaSchema = z.array(z.object({ role: z.string(), value: z.string() }))
const examples = routerWorkshopModels.flatMap((model) => {
  const source = routerContentBySlug.get(model.slug)
  if (!source || source.alias.contentIssue) return []
  return source.overlay.examples.flatMap((example, index) => {
    if (!Object.hasOwn(example.values, 'medias')) return []
    const media = mediaSchema.parse(example.values.medias)
    return media.length
      ? [{ slug: model.slug, index: index + 1, example, media }]
      : []
  })
})

describe('published example media', () => {
  it.for(examples)(
    'preserves every authored media URL in an input widget: $slug / $index',
    ({ slug, example, media }) => {
      const model = getRouterWorkshopModelDetail(slug)
      if (!model?.execution) throw new Error('Missing example contract')
      const schema = schemaForModel(model)
      const values = defaultValues(
        schema,
        workshopExampleValues(model.execution, example.values)
      )
      const urls = schema
        .filter((field) => field.kind === 'file' || urlUploadField(field))
        .flatMap((field) => {
          const value = values[field.name]
          if (typeof value === 'string') return [value]
          if (!value || typeof value !== 'object') return []
          return (Array.isArray(value) ? value : [value]).flatMap((file) =>
            file.previewUrl ? [file.previewUrl] : []
          )
        })
      for (const asset of media) expect(urls).toContain(asset.value)
    }
  )
})
