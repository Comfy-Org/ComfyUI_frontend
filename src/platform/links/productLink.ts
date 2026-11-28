const PRODUCT_LINK_SOURCES = {
  cloud: 'comfy_cloud',
  desktop: 'comfy_desktop',
  localhost: 'comfyui_local'
} as const

function isComfyOrgHost(hostname: string): boolean {
  return hostname === 'comfy.org' || hostname.endsWith('.comfy.org')
}

/**
 * Tags a comfy.org link with this product's UTM parameters.
 * See docs/guidance/product-links.md.
 */
export function productLink(url: string, campaign: string): string {
  const link = new URL(url)
  if (!isComfyOrgHost(link.hostname)) return url
  link.searchParams.set('utm_source', PRODUCT_LINK_SOURCES[__DISTRIBUTION__])
  link.searchParams.set('utm_medium', 'product')
  link.searchParams.set('utm_campaign', campaign)
  return link.toString()
}
