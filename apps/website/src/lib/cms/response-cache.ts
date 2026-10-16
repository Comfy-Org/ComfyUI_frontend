/** Mutable CMS documents must bypass browser and provider response caches. */
export function mutableCatalogPath(path: string) {
  return (
    path === '/' ||
    /^\/(?:[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?\/)?(?:hub|models)(?:\/|\.md\/?$|$)/.test(
      path
    ) ||
    /^\/(?:[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?\/)?(?:sitemap(?:-[a-z0-9-]+)?\.xml|llms(?:-full)?\.txt)$/.test(
      path
    ) ||
    /^\/(?:admin|api\/v1\/catalog|preview-media|catalog-media)(?:\/|$)/.test(
      path
    ) ||
    ['/agents', '/openapi.json'].includes(path.replace(/\/$/, ''))
  )
}

export function catalogResponseNoStore(response: Response) {
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'private, no-store')
  for (const name of [
    'CDN-Cache-Control',
    'Vercel-CDN-Cache-Control',
    'Cloudflare-CDN-Cache-Control'
  ])
    headers.set(name, 'no-store')
  headers.set('X-Comfy-Content-Source', 'cms')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}
