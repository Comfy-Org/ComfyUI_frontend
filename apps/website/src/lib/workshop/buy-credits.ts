import { externalLinks } from '../../config/routes'

// Credits are bought on the platform site, which sends the visitor back to the
// page they left. Only same-site paths go into the return address.
export function platformCreditsHref(returnPath: string): string {
  const url = new URL(externalLinks.platform)
  url.searchParams.set('utm_source', 'workshop')
  if (returnPath.startsWith('/') && !returnPath.startsWith('//'))
    url.searchParams.set('returnTo', returnPath)
  return url.toString()
}
