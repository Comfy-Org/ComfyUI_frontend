import { describe, expect, it } from 'vitest'

import { getAuthoredRouterWorkshopModelDetail } from '@/config/workshop-router-content'
import { frameParameters, watermarksOff } from './frames'
import { runnableCinematicModels } from './models'
import { studioRouterForm } from './request'

const operations = runnableCinematicModels(
  getAuthoredRouterWorkshopModelDetail
).flatMap((model) =>
  [...new Set([model.slug, model.referenceSlug])].flatMap((slug) => {
    const detail = slug && getAuthoredRouterWorkshopModelDetail(slug)
    return detail
      ? [
          {
            name: detail.name,
            detail,
            aspect: model.aspects?.[0],
            // Edit operations only ever run with the shot's references.
            edit: slug !== model.slug
          }
        ]
      : []
  })
)

const cast = new File(['cast'], 'cast.png', { type: 'image/png' })

/** Files, catalogue links and watermark switches that are on, anywhere. */
function found(value: unknown, path = ''): string[] {
  if (value instanceof Blob) return value === cast ? [] : [`${path} file`]
  if (typeof value === 'string')
    return /^https:\/\/(media\.comfy\.org|cdn\.jsdelivr\.net)\//.test(value)
      ? [`${path} example`]
      : []
  if (Array.isArray(value))
    return value.flatMap((item, index) => found(item, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, item]) =>
    /watermark/i.test(key) && item === true
      ? [`${path}${key} on`]
      : found(item, `${path}${key}.`)
  )
}

describe('studioRouterForm', () => {
  it.for(operations)(
    'sends $name no catalogue example and no watermark',
    ({ detail, aspect, edit }) => {
      const frame = frameParameters(detail.execution, aspect ?? '1:1', 2048)
      const clean = watermarksOff(detail.execution)
      const { values } = studioRouterForm(detail, {
        prompt: 'A lighthouse at dusk',
        ...frame,
        ...(clean
          ? { model_specific: { ...frame.model_specific, ...clean } }
          : {}),
        ...(edit ? { reference_images: [cast] } : {})
      })
      expect(found(values)).toEqual([])
      expect(values.prompt).toBe('A lighthouse at dusk')
    }
  )
})
