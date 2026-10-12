import type { ReviewFilter } from './staging-review'
import { filterQuery } from './staging-review'

export async function reviewRequest(
  operation:
    | 'staging'
    | 'final-review'
    | 'exit'
    | 'discard-changes'
    | 'publish',
  options: {
    filter?: ReviewFilter
    csrf?: string
    body?: string
    key?: string
  } = {}
) {
  const headers = new Headers()
  if (options.csrf) headers.set('X-Comfy-CSRF', options.csrf)
  if (options.key) headers.set('Idempotency-Key', options.key)
  if (options.body) headers.set('Content-Type', 'application/json')
  const query = options.filter ? filterQuery(options.filter).toString() : ''
  try {
    const response = await fetch(
      `/admin/catalog-api/${operation}${query ? `?${query}` : ''}`,
      {
        method:
          options.body !== undefined || operation === 'exit' ? 'POST' : 'GET',
        body: options.body,
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error'
      }
    )
    if (response.status === 204)
      return { ok: true, status: 204, data: undefined }
    let data: unknown
    try {
      data = await response.json()
    } catch {
      data = undefined
    }
    return { ok: response.ok, status: response.status, data }
  } catch {
    return { ok: false, status: 503, data: undefined }
  }
}
