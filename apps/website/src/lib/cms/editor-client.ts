export async function editorRequest(
  operation: 'state' | 'item' | 'save' | 'upload',
  options: {
    uid?: string
    csrf?: string
    key?: string
    body?: FormData | string
  } = {}
) {
  const headers = new Headers()
  if (options.csrf) headers.set('X-Comfy-CSRF', options.csrf)
  if (options.key) headers.set('Idempotency-Key', options.key)
  if (typeof options.body === 'string')
    headers.set('Content-Type', 'application/json')
  const path = `/admin/content-api/${operation}${options.uid ? `?uid=${encodeURIComponent(options.uid)}` : ''}`
  try {
    const response = await fetch(path, {
      method: options.body ? 'POST' : 'GET',
      body: options.body,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error'
    })
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
