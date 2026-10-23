const CAMPAIGN_PARAMETERS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term'
] as const

export function campaignHref(href: string, pageUrl: string): string {
  if (href.startsWith('#')) return href
  const page = new URL(pageUrl)
  const destination = new URL(href, page)
  if (
    !['http:', 'https:'].includes(destination.protocol) ||
    (destination.origin !== page.origin &&
      !['comfy.org', 'cloud.comfy.org'].includes(destination.hostname))
  )
    return href

  for (const key of CAMPAIGN_PARAMETERS) {
    const value = page.searchParams.get(key)
    if (value && !destination.searchParams.has(key))
      destination.searchParams.set(key, value)
  }
  return href.startsWith('/') && !href.startsWith('//')
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : destination.href
}
