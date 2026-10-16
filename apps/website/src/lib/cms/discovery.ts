function unavailableDocumentation() {
  return new Response('Catalog documentation temporarily unavailable', {
    status: 503,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
  })
}

type DocumentationPath =
  | '/agents'
  | '/openapi.json'
  | '/api/v1/catalog/agents'
  | '/api/v1/catalog/openapi.json'
  | '/api/v1/catalog/docs'
function documentationURL(origin: string, path: DocumentationPath) {
  let url: URL
  try {
    const upstreamPath =
      path === '/agents'
        ? '/api/v1/catalog/agents'
        : path === '/openapi.json'
          ? '/api/v1/catalog/openapi.json'
          : path
    url = new URL(upstreamPath, origin)
  } catch {
    return undefined
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    return undefined
  return url
}
function documentationType(path: DocumentationPath) {
  if (path.endsWith('/openapi.json')) return 'application/json'
  return path.endsWith('/docs') ? 'text/html' : 'text/plain'
}
export async function proxyCatalogDocumentation(path: DocumentationPath) {
  const origin = process.env.SITE_CATALOG_API_URL
  if (!origin || process.env.VERCEL_ENV === 'production')
    return unavailableDocumentation()
  const url = documentationURL(origin, path)
  if (!url) return unavailableDocumentation()
  let response: Response
  try {
    response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000)
    })
  } catch {
    return unavailableDocumentation()
  }

  const expectedType = documentationType(path)
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!response.ok || !contentType.startsWith(expectedType))
    return unavailableDocumentation()

  let body: ArrayBuffer
  try {
    body = await response.arrayBuffer()
  } catch {
    return unavailableDocumentation()
  }
  if (body.byteLength > 1024 * 1024) return unavailableDocumentation()

  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
    }
  })
}
