import { safeInternalPath } from '@/lib/cms/preview-display'

export type CatalogPreviewLocale = 'en' | 'zh-CN'
export interface CatalogPreviewCommand {
  view: 'DRAFT' | 'LIVE'
  now?: string
  locale?: CatalogPreviewLocale
}

export function previewNavigationPath(
  path: string,
  locale?: CatalogPreviewLocale
): string | undefined {
  const safe = safeInternalPath(path)
  if (!safe) return
  if (!locale) return safe
  const url = new URL(safe, 'https://comfy.org')
  const unprefixed = url.pathname.replace(/^\/zh-CN(?=\/|$)/, '') || '/'
  const pathname = locale === 'zh-CN' ? `/zh-CN${unprefixed}` : unprefixed
  return `${pathname}${url.search}${url.hash}`
}

export async function updateCatalogPreview(
  command: CatalogPreviewCommand,
  csrf: string
): Promise<boolean> {
  if (!csrf) return false
  try {
    const response = await fetch('/admin/catalog-preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Comfy-CSRF': csrf
      },
      body: JSON.stringify(command),
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000)
    })
    return response.status === 204 && !response.redirected
  } catch {
    return false
  }
}
