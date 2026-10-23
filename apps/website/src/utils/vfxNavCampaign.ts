import { externalLinks } from '@/config/routes'

/** The campaign exception applies only to the public English/Chinese VFX V3 routes. */
export function isVfxV3Path(path: string): boolean {
  return /^\/(?:zh-CN\/)?solutions\/vfx\/v3\/?$/.test(path)
}

export function vfxNavCloudHref(
  pagePath: string,
  href = externalLinks.cloudCta('nav_try_cloud')
): string {
  if (!isVfxV3Path(pagePath)) return href
  const destination = new URL(href)
  const utmKeys = [...destination.searchParams.keys()].filter((key) =>
    key.toLowerCase().startsWith('utm_')
  )
  for (const key of utmKeys) destination.searchParams.delete(key)
  return destination.href
}
